-- Migration 004: Storefront Client Improvements (Fiado Authorization, CEPs, Dynamic Hours & Troco Rules)

-- 1. Adicionar coluna fiado_autorizado na tabela clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fiado_autorizado BOOLEAN NOT NULL DEFAULT true;

-- 2. Tabela de CEPs atendidos para entrega oficial
CREATE TABLE IF NOT EXISTS public.ceps_atendidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cep TEXT NOT NULL UNIQUE,
    bairro TEXT NOT NULL,
    valor_frete NUMERIC(10, 2) NOT NULL DEFAULT 7.00,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceps_atendidos_cep ON public.ceps_atendidos(cep);
CREATE INDEX IF NOT EXISTS idx_ceps_atendidos_bairro ON public.ceps_atendidos(bairro);

ALTER TABLE public.ceps_atendidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de ceps_atendidos" ON public.ceps_atendidos;
CREATE POLICY "Leitura publica de ceps_atendidos" ON public.ceps_atendidos
    FOR SELECT TO authenticated, anon USING (ativo = true);

DROP POLICY IF EXISTS "Gerenciamento de ceps_atendidos por admin" ON public.ceps_atendidos;
CREATE POLICY "Gerenciamento de ceps_atendidos por admin" ON public.ceps_atendidos
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Tabela de Configurações da Adega (Horários e Status)
CREATE TABLE IF NOT EXISTS public.configuracoes_adega (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracoes_adega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de configuracoes_adega" ON public.configuracoes_adega;
CREATE POLICY "Leitura publica de configuracoes_adega" ON public.configuracoes_adega
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Gerenciamento de configuracoes_adega por admin" ON public.configuracoes_adega;
CREATE POLICY "Gerenciamento de configuracoes_adega por admin" ON public.configuracoes_adega
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed inicial de horários
INSERT INTO public.configuracoes_adega (chave, valor)
VALUES 
    ('horario_abertura', '18:00'),
    ('horario_fechamento', '02:00'),
    ('status_manual', 'auto')
ON CONFLICT (chave) DO NOTHING;

-- 4. Atualização da RPC consultar_fiado para validar fiado_autorizado
CREATE OR REPLACE FUNCTION public.consultar_fiado(
    p_whatsapp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cleaned_whatsapp TEXT;
    v_cliente RECORD;
    v_limite NUMERIC(10, 2);
    v_saldo NUMERIC(10, 2);
    v_disponivel NUMERIC(10, 2);
    v_aprovado BOOLEAN;
    v_rate_allowed BOOLEAN;
BEGIN
    v_cleaned_whatsapp := regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g');

    IF length(v_cleaned_whatsapp) < 10 THEN
        RETURN jsonb_build_object(
            'aprovado', false,
            'motivo_recusa', 'Informe um número de WhatsApp válido com DDD.'
        );
    END IF;

    -- Rate limiting no banco (10 consultas a cada 5 min por WhatsApp)
    v_rate_allowed := public.checar_rate_limit('fiado', v_cleaned_whatsapp, 10, 300);
    IF NOT v_rate_allowed THEN
        RETURN jsonb_build_object(
            'aprovado', false,
            'motivo_recusa', 'Muitas consultas realizadas. Aguarde alguns minutos.'
        );
    END IF;

    -- Registrar consulta no log de auditoria
    INSERT INTO public.fiado_consultas_log (whatsapp) VALUES (v_cleaned_whatsapp);

    -- Buscar cliente cadastrado
    SELECT id, limite_fiado, saldo_fiado_atual, fiado_autorizado
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

    -- Validação de autorização individual de fiado
    IF NOT COALESCE(v_cliente.fiado_autorizado, true) THEN
        RETURN jsonb_build_object(
            'aprovado', false,
            'motivo_recusa', 'Opção de compra no Fiado não autorizada para este cadastro.'
        );
    END IF;

    v_limite := COALESCE(v_cliente.limite_fiado, 300.00);
    v_saldo := COALESCE(v_cliente.saldo_fiado_atual, 0.00);
    v_disponivel := GREATEST(0.00, v_limite - v_saldo);
    v_aprovado := (v_disponivel > 0);

    RETURN jsonb_build_object(
        'cliente_id', v_cliente.id,
        'aprovado', v_aprovado,
        'saldo_disponivel', v_disponivel,
        'motivo_recusa', CASE 
            WHEN NOT v_aprovado THEN 'Limite de Fiado atingido ou saldo indisponível.' 
            ELSE NULL 
        END
    );
END;
$$;

-- 5. Atualização da RPC criar_pedido com validação de troco (troco_para > total) e fiado_autorizado
CREATE OR REPLACE FUNCTION public.criar_pedido(
    p_cliente_id UUID,
    p_cliente_nome TEXT,
    p_cliente_whatsapp TEXT,
    p_endereco_rua TEXT,
    p_endereco_numero TEXT,
    p_endereco_bairro TEXT,
    p_endereco_complemento TEXT,
    p_ponto_referencia TEXT,
    p_forma_pagamento TEXT,
    p_troco_para NUMERIC(10, 2),
    p_taxa_entrega NUMERIC(10, 2),
    p_chave_idempotencia UUID,
    p_valor_esperado NUMERIC(10, 2),
    p_confirmou_divergencia BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pedido_existente RECORD;
    v_novo_pedido_id UUID;
    v_item RECORD;
    v_prod RECORD;
    v_subtotal NUMERIC(10, 2) := 0.00;
    v_subtotal_calculado NUMERIC(10, 2) := 0.00;
    v_total_calculado NUMERIC(10, 2) := 0.00;
    v_taxa_final NUMERIC(10, 2);
    v_codigo_entrega TEXT;
    v_clienteRECORD RECORD;
    v_saldo_disponivel NUMERIC(10, 2);
    v_rate_allowed BOOLEAN;
BEGIN
    -- 0. Rate limiting no banco (5 pedidos a cada 10 min por WhatsApp)
    v_rate_allowed := public.checar_rate_limit('checkout', p_cliente_whatsapp, 5, 600);
    IF NOT v_rate_allowed THEN
        RAISE EXCEPTION 'Muitos pedidos enviados recentemente. Aguarde alguns minutos.' USING ERRCODE = 'P0011';
    END IF;

    -- 1. Idempotência
    SELECT id, status, valor_total, codigo_entrega INTO v_pedido_existente
    FROM public.pedidos
    WHERE chave_idempotencia = p_chave_idempotencia;

    IF v_pedido_existente.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'id', v_pedido_existente.id,
            'status', v_pedido_existente.status,
            'valor_total', v_pedido_existente.valor_total,
            'codigo_entrega', v_pedido_existente.codigo_entrega,
            'idempotente', true
        );
    END IF;

    -- 2. Validar sacola
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'pg_temp' AND tablename = 'temp_cart_items') THEN
        RAISE EXCEPTION 'Sacola de compras vazia.' USING ERRCODE = 'P0001';
    END IF;

    -- 3. Validar estoque e calcular subtotal (FOR UPDATE)
    FOR v_item IN SELECT produto_id, quantidade FROM temp_cart_items LOOP
        SELECT id, nome, preco, estoque_atual, ativo INTO v_prod
        FROM public.produtos
        WHERE id = v_item.produto_id
        FOR UPDATE;

        IF v_prod.id IS NULL OR NOT v_prod.ativo THEN
            RAISE EXCEPTION 'Produto não encontrado ou inativo.' USING ERRCODE = 'P0002';
        END IF;

        IF v_prod.estoque_atual < v_item.quantidade THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto % (Disponível: %, Solicitado: %).', 
                v_prod.nome, v_prod.estoque_atual, v_item.quantidade USING ERRCODE = 'P0002';
        END IF;

        v_subtotal_calculado := v_subtotal_calculado + (v_prod.preco * v_item.quantidade);
    END LOOP;

    -- 4. Definir taxa de entrega oficial do servidor
    v_taxa_final := COALESCE(p_taxa_entrega, 7.00);
    v_total_calculado := v_subtotal_calculado + v_taxa_final;

    -- 5. Validação de divergência de preço
    IF p_valor_esperado IS NOT NULL AND Math.abs(v_total_calculado - p_valor_esperado) > 0.05 THEN
        IF NOT COALESCE(p_confirmou_divergencia, FALSE) THEN
            RAISE EXCEPTION 'PRECO_DIVERGENTE: O valor dos produtos ou taxa foi atualizado. Valor original: R$ %, Novo total: R$ %.',
                p_valor_esperado, v_total_calculado USING ERRCODE = 'P0005';
        END IF;
    END IF;

    -- 6. Validação CORRIGIDA de troco em dinheiro (p_troco_para DEVE ser estritamente maior que o total do pedido)
    IF p_forma_pagamento = 'dinheiro' AND p_troco_para IS NOT NULL AND p_troco_para > 0 THEN
        IF p_troco_para <= v_total_calculado THEN
            RAISE EXCEPTION 'O valor informado para troco (R$ %) deve ser maior que o valor total do pedido (R$ %).', 
                p_troco_para, v_total_calculado USING ERRCODE = 'P0004';
        END IF;
    END IF;

    -- 7. Validação de autorização e limite de Fiado no servidor (FOR UPDATE)
    IF p_forma_pagamento = 'fiado' THEN
        SELECT id, limite_fiado, saldo_fiado_atual, fiado_autorizado INTO v_clienteRECORD
        FROM public.clientes
        WHERE regexp_replace(whatsapp, '\D', '', 'g') = regexp_replace(p_cliente_whatsapp, '\D', '', 'g')
        FOR UPDATE;

        IF v_clienteRECORD.id IS NULL THEN
            RAISE EXCEPTION 'Cadastro Fiado não encontrado para o WhatsApp informado.' USING ERRCODE = 'P0003';
        END IF;

        IF NOT COALESCE(v_clienteRECORD.fiado_autorizado, true) THEN
            RAISE EXCEPTION 'Compras no Fiado não estão autorizadas para este cadastro.' USING ERRCODE = 'P0003';
        END IF;

        v_saldo_disponivel := COALESCE(v_clienteRECORD.limite_fiado, 300.00) - COALESCE(v_clienteRECORD.saldo_fiado_atual, 0.00);

        IF v_total_calculado > v_saldo_disponivel THEN
            RAISE EXCEPTION 'Limite de Fiado excedido. Saldo disponível: R$ %, Total do pedido: R$ %.', 
                v_saldo_disponivel, v_total_calculado USING ERRCODE = 'P0003';
        END IF;
    END IF;

    -- 8. Gerar código de entrega único de 4 dígitos
    v_codigo_entrega := lpad(floor(random() * 10000)::text, 4, '0');

    -- 9. Inserir o pedido na tabela principal
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
        subtotal,
        valor_total,
        codigo_entrega,
        chave_idempotencia,
        status,
        criado_em,
        atualizado_em
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
        p_troco_para,
        v_taxa_final,
        v_subtotal_calculado,
        v_total_calculado,
        v_codigo_entrega,
        p_chave_idempotencia,
        'pendente',
        NOW(),
        NOW()
    ) RETURNING id INTO v_novo_pedido_id;

    -- 10. Inserir os itens do pedido e decrementar estoque
    FOR v_item IN SELECT produto_id, quantidade FROM temp_cart_items LOOP
        SELECT preco INTO v_prod FROM public.produtos WHERE id = v_item.produto_id;

        INSERT INTO public.itens_pedido (
            pedido_id,
            produto_id,
            quantidade,
            preco_unitario,
            subtotal
        ) VALUES (
            v_novo_pedido_id,
            v_item.produto_id,
            v_item.quantidade,
            v_prod.preco,
            v_prod.preco * v_item.quantidade
        );

        UPDATE public.produtos
        SET estoque_atual = estoque_atual - v_item.quantidade,
            atualizado_em = NOW()
        WHERE id = v_item.produto_id;
    END LOOP;

    -- 11. Atualizar saldo fiado se aplicável
    IF p_forma_pagamento = 'fiado' AND v_clienteRECORD.id IS NOT NULL THEN
        UPDATE public.clientes
        SET saldo_fiado_atual = COALESCE(saldo_fiado_atual, 0.00) + v_total_calculado,
            atualizado_em = NOW()
        WHERE id = v_clienteRECORD.id;
    END IF;

    -- 12. Retornar resposta
    RETURN jsonb_build_object(
        'id', v_novo_pedido_id,
        'status', 'pendente',
        'subtotal', v_subtotal_calculado,
        'taxa_entrega', v_taxa_final,
        'valor_total', v_total_calculado,
        'codigo_entrega', v_codigo_entrega,
        'idempotente', false
    );
END;
$$;
