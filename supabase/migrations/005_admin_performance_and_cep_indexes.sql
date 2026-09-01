-- Migration 005: Admin Performance & CEP Bulk Import

-- 1. Índices de alta performance para acelerar o dashboard, busca de clientes, produtos e CEPs
CREATE INDEX IF NOT EXISTS idx_pedidos_status_criado ON public.pedidos(status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em ON public.pedidos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON public.clientes(whatsapp);
CREATE INDEX IF NOT EXISTS idx_clientes_fiado_autorizado ON public.clientes(fiado_autorizado);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo_destaque ON public.produtos(ativo, destaque);
CREATE INDEX IF NOT EXISTS idx_ceps_atendidos_cep_ativo ON public.ceps_atendidos(cep, ativo);
CREATE INDEX IF NOT EXISTS idx_configuracoes_adega_chave ON public.configuracoes_adega(chave);

-- 2. Função RPC para importação em lote / cadastro em massa de CEPs
CREATE OR REPLACE FUNCTION public.importar_ceps_em_massa(
    p_ceps JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item JSONB;
    v_cep TEXT;
    v_bairro TEXT;
    v_frete NUMERIC(10, 2);
    v_inseridos INT := 0;
    v_atualizados INT := 0;
    v_existente RECORD;
BEGIN
    -- Validar que o usuário atual é admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado: Apenas administradores podem cadastrar CEPs em massa.' USING ERRCODE = 'P0001';
    END IF;

    IF jsonb_typeof(p_ceps) != 'array' THEN
        RAISE EXCEPTION 'Formato inválido: O parâmetro deve ser uma lista JSON.' USING ERRCODE = 'P0002';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_ceps) LOOP
        v_cep := regexp_replace(COALESCE(v_item->>'cep', ''), '\D', '', 'g');
        v_bairro := COALESCE(v_item->>'bairro', 'Cubatão / Baixada Santista');
        v_frete := COALESCE((v_item->>'valor_frete')::NUMERIC, 7.00);

        IF length(v_cep) = 8 THEN
            SELECT id FROM public.ceps_atendidos WHERE cep = v_cep INTO v_existente;

            IF v_existente.id IS NOT NULL THEN
                UPDATE public.ceps_atendidos
                SET bairro = v_bairro,
                    valor_frete = v_frete,
                    ativo = true
                WHERE id = v_existente.id;
                v_atualizados := v_atualizados + 1;
            ELSE
                INSERT INTO public.ceps_atendidos (cep, bairro, valor_frete, ativo)
                VALUES (v_cep, v_bairro, v_frete, true);
                v_inseridos := v_inseridos + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'sucesso', true,
        'inseridos', v_inseridos,
        'atualizados', v_atualizados,
        'total_processados', v_inseridos + v_atualizados
    );
END;
$$;
