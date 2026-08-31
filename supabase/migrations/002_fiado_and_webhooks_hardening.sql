-- ============================================================================
-- TELES ADEGA DELIVERY - MIGRATION 002: HARDENING DE FIADO & SEGURANÇA DE RPC
-- Data: 2026-08-31
-- Descrição: RPC consultar_fiado, validação de limite fiado em criar_pedido e log de consultas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELA DE AUDITORIA DE CONSULTAS DE FIADO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiado_consultas_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fiado_consultas_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bloqueia acesso via client log fiado" ON public.fiado_consultas_log;
CREATE POLICY "Bloqueia acesso via client log fiado" ON public.fiado_consultas_log
    FOR ALL TO authenticated, anon USING (false);

-- ----------------------------------------------------------------------------
-- 2. BLOQUEIO DE SELEÇÃO DIRETA PÚBLICA NA TABELA CLIENTES
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.clientes FROM anon;

-- ----------------------------------------------------------------------------
-- 3. RPC: consultar_fiado (RETORNO SANITIZADO DE CRÉDITO)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consultar_fiado(
    p_whatsapp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cleaned_whatsapp TEXT;
    v_cliente RECORD;
    v_limite NUMERIC(10, 2);
    v_saldo NUMERIC(10, 2);
    v_disponivel NUMERIC(10, 2);
    v_aprovado BOOLEAN;
BEGIN
    v_cleaned_whatsapp := regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g');

    IF length(v_cleaned_whatsapp) < 10 THEN
        RETURN jsonb_build_object(
            'aprovado', false,
            'motivo_recusa', 'Informe um número de WhatsApp válido com DDD.'
        );
    END IF;

    -- Auditoria de consulta
    INSERT INTO public.fiado_consultas_log (whatsapp) VALUES (v_cleaned_whatsapp);

    -- Buscar cliente cadastrado
    SELECT id, nome, whatsapp, limite_fiado, saldo_fiado_atual
    INTO v_cliente
    FROM public.clientes
    WHERE regexp_replace(whatsapp, '\D', '', 'g') = v_cleaned_whatsapp
    LIMIT 1;

    IF v_cliente.id IS NULL THEN
        RETURN jsonb_build_object(
            'aprovado', false,
            'motivo_recusa', 'Cadastro Fiado não encontrado. Fale com a adega via WhatsApp para abrir seu crédito.'
        );
    END IF;

    v_limite := COALESCE(v_cliente.limite_fiado, 300.00);
    v_saldo := COALESCE(v_cliente.saldo_fiado_atual, 0.00);
    v_disponivel := GREATEST(0.00, v_limite - v_saldo);
    v_aprovado := (v_disponivel > 0);

    RETURN jsonb_build_object(
        'cliente_id', v_cliente.id,
        'nome', v_cliente.nome,
        'whatsapp', v_cliente.whatsapp,
        'limite_fiado', v_limite,
        'saldo_fiado_atual', v_saldo,
        'saldo_disponivel', v_disponivel,
        'aprovado', v_aprovado,
        'motivo_recusa', CASE 
            WHEN NOT v_aprovado THEN 'Limite de Fiado atingido ou saldo indisponível.' 
            ELSE NULL 
        END
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC ATUALIZADA: criar_pedido (INCORPORA VALIDAÇÃO DE FIADO COM LOCK)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_pedido(
    p_cliente_nome TEXT,
    p_cliente_whatsapp TEXT,
    p_endereco_rua TEXT,
    p_endereco_numero TEXT,
    p_endereco_bairro TEXT,
    p_itens JSONB,
    p_forma_pagamento forma_pagamento,
    p_endereco_complemento TEXT DEFAULT NULL,
    p_ponto_referencia TEXT DEFAULT NULL,
    p_troco_para NUMERIC DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_taxa_entrega NUMERIC DEFAULT NULL,
    p_chave_idempotencia UUID DEFAULT NULL,
    p_valor_esperado NUMERIC DEFAULT NULL,
    p_confirmar_divergencia BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_zona_frete NUMERIC(10, 2);
    v_taxa_entrega NUMERIC(10, 2);
    v_valor_produtos NUMERIC(10, 2) := 0.00;
    v_valor_total NUMERIC(10, 2);
    v_item JSONB;
    v_produto_id UUID;
    v_quantidade INT;
    v_preco NUMERIC(10, 2);
    v_subtotal NUMERIC(10, 2);
    v_produto_ativo BOOLEAN;
    v_produto_nome TEXT;
    v_pedido_id UUID;
    v_status status_pedido;
    v_chave_idempotencia UUID;
    v_limite_fiado NUMERIC(10, 2);
    v_saldo_fiado NUMERIC(10, 2);
    v_nome_cliente_fiado TEXT;
    v_resultado JSONB;
BEGIN
    -- 1. Validar itens
    IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'O pedido deve conter pelo menos um item.' USING ERRCODE = 'P0004';
    END IF;

    -- 2. Obter frete da zona cadastrada no servidor
    SELECT valor_frete INTO v_zona_frete
    FROM public.zonas_frete
    WHERE LOWER(bairro) = LOWER(p_endereco_bairro) AND ativo = true
    LIMIT 1;

    v_taxa_entrega := COALESCE(v_zona_frete, p_taxa_entrega, 0.00);

    -- 3. Iterar e calcular preços no servidor com FOR UPDATE
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_produto_id := (v_item->>'produto_id')::uuid;
        v_quantidade := (v_item->>'quantidade')::int;

        IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida para o produto ID %', v_produto_id USING ERRCODE = 'P0005';
        END IF;

        SELECT preco, ativo, nome INTO v_preco, v_produto_ativo, v_produto_nome
        FROM public.produtos
        WHERE id = v_produto_id
        FOR UPDATE;

        IF v_preco IS NULL THEN
            RAISE EXCEPTION 'Produto não encontrado: %', v_produto_id USING ERRCODE = 'P0006';
        END IF;

        IF NOT v_produto_ativo THEN
            RAISE EXCEPTION 'Produto "%" não está mais disponível no momento.', v_produto_nome USING ERRCODE = 'P0007';
        END IF;

        v_subtotal := v_preco * v_quantidade;
        v_valor_produtos := v_valor_produtos + v_subtotal;
    END LOOP;

    v_valor_total := v_valor_produtos + v_taxa_entrega;

    -- 4. Verificar divergência de preço se cliente enviou valor esperado
    IF p_valor_esperado IS NOT NULL AND NOT p_confirmar_divergencia AND ABS(v_valor_total - p_valor_esperado) > 0.01 THEN
        RAISE EXCEPTION 'PRECO_DIVERGENTE:%', v_valor_total USING ERRCODE = 'P0009';
    END IF;

    -- 5. Validar troco se dinheiro
    IF p_forma_pagamento = 'dinheiro' AND p_troco_para IS NOT NULL AND p_troco_para > 0 AND p_troco_para < v_valor_total THEN
        RAISE EXCEPTION 'O valor para troco (R$ %) deve ser maior ou igual ao total do pedido (R$ %).', p_troco_para, v_valor_total USING ERRCODE = 'P0008';
    END IF;

    -- 6. Validação rigorosa de FIADO no servidor com LOCK
    IF p_forma_pagamento = 'fiado' THEN
        IF p_cliente_id IS NULL THEN
            RAISE EXCEPTION 'Para compras na modalidade FIADO, é obrigatório selecionar um cadastro de cliente aprovado.' USING ERRCODE = 'P0002';
        END IF;

        SELECT limite_fiado, saldo_fiado_atual, nome INTO v_limite_fiado, v_saldo_fiado, v_nome_cliente_fiado
        FROM public.clientes
        WHERE id = p_cliente_id
        FOR UPDATE;

        IF v_limite_fiado IS NULL THEN
            RAISE EXCEPTION 'Cadastro de cliente Fiado não encontrado.' USING ERRCODE = 'P0010';
        END IF;

        IF (v_saldo_fiado + v_valor_total) > v_limite_fiado THEN
            RAISE EXCEPTION 'Limite de Fiado Excedido para "%". (Limite: R$ %, Saldo Devedor Atual: R$ %, Pedido: R$ %).',
                v_nome_cliente_fiado, v_limite_fiado, v_saldo_fiado, v_valor_total USING ERRCODE = 'P0003';
        END IF;
    END IF;

    v_status := CASE WHEN p_forma_pagamento = 'pix' THEN 'aguardando_pagamento'::status_pedido ELSE 'pendente_aprovacao'::status_pedido END;
    v_chave_idempotencia := COALESCE(p_chave_idempotencia, gen_random_uuid());

    -- 7. Inserir pedido
    INSERT INTO public.pedidos (
        cliente_id,
        cliente_nome,
        cliente_whatsapp,
        endereco_rua,
        endereco_numero,
        endereco_bairro,
        endereco_complemento,
        ponto_referencia,
        forma_pagamento,
        troco_para,
        taxa_entrega,
        valor_produtos,
        valor_total,
        status,
        chave_idempotencia
    ) VALUES (
        p_cliente_id,
        p_cliente_nome,
        p_cliente_whatsapp,
        p_endereco_rua,
        p_endereco_numero,
        p_endereco_bairro,
        p_endereco_complemento,
        p_ponto_referencia,
        p_forma_pagamento,
        CASE WHEN p_forma_pagamento = 'dinheiro' THEN p_troco_para ELSE NULL END,
        v_taxa_entrega,
        v_valor_produtos,
        v_valor_total,
        v_status,
        v_chave_idempotencia
    ) RETURNING id INTO v_pedido_id;

    -- 8. Inserir itens do pedido com os preços recalculados
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_produto_id := (v_item->>'produto_id')::uuid;
        v_quantidade := (v_item->>'quantidade')::int;

        SELECT preco INTO v_preco FROM public.produtos WHERE id = v_produto_id;
        v_subtotal := v_preco * v_quantidade;

        INSERT INTO public.itens_pedido (
            pedido_id,
            produto_id,
            quantidade,
            preco_unitario,
            subtotal
        ) VALUES (
            v_pedido_id,
            v_produto_id,
            v_quantidade,
            v_preco,
            v_subtotal
        );
    END LOOP;

    SELECT jsonb_build_object(
        'id', id,
        'valor_produtos', valor_produtos,
        'taxa_entrega', taxa_entrega,
        'valor_total', valor_total,
        'status', status,
        'codigo_entrega', codigo_entrega
    ) INTO v_resultado
    FROM public.pedidos
    WHERE id = v_pedido_id;

    RETURN v_resultado;
END;
$$;
