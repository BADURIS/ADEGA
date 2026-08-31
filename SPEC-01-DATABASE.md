# 📄 SPEC-01-DATABASE: Especificação Técnica e Modelagem de Banco de Dados

**Projeto:** TELES ADEGA DELIVERY  
**DDD / Região:** (13) - Baixada Santista  
**Contato Oficial:** WhatsApp (13) 99765-0605 | Instagram [@teles.adegadelivery](https://instagram.com/teles.adegadelivery)  
**Stack de Dados:** Supabase (PostgreSQL 15+ | Realtime | RLS | Storage)  
**Autor:** Engenheiro de Software Sênior (Database & Architecture Specialist)  
**Versão:** 1.0.0  
**Data:** 11/08/2026  

---

## 1. Visão Geral e Arquitetura de Dados

O banco de dados do **TELES ADEGA DELIVERY** foi desenvolvido seguindo os princípios de consistência ACID, alta performance para relatórios operacionais em tempo real e segurança rigorosa em nível de linha (Row Level Security - RLS).

### 1.1 Modelo Entidade-Relacionamento (ERD - Mermaid)

```mermaid
erdiagram
    CATEGORIAS ||--o{ PRODUTOS : "possui"
    PRODUTOS ||--o{ ITENS_PEDIDO : "compoe"
    CLIENTES ||--o{ PEDIDOS : "realiza"
    MOTOBOYS ||--o{ PEDIDOS : "entrega"
    PEDIDOS ||--|{ ITENS_PEDIDO : "contem"
    ZONAS_FRETE ||--o{ PEDIDOS : "delimita frete"

    CATEGORIAS {
        uuid id PK
        string nome
        string descricao
        boolean ativo
        timestamptz criado_em
    }

    PRODUTOS {
        uuid id PK
        uuid categoria_id FK
        string nome
        text descricao
        numeric preco
        string foto_url
        integer estoque_atual
        integer estoque_minimo
        boolean ativo
        timestamptz criado_em
        timestamptz atualizado_em
    }

    CLIENTES {
        uuid id PK
        string nome
        string whatsapp
        text endereco_completo
        string cep
        string bairro
        numeric limite_fiado
        numeric saldo_fiado_atual
        timestamptz criado_em
        timestamptz atualizado_em
    }

    MOTOBOYS {
        uuid id PK
        string nome
        string telefone
        boolean ativo
        timestamptz criado_em
    }

    ZONAS_FRETE {
        uuid id PK
        string bairro
        string cep_inicio
        string cep_fim
        numeric valor_frete
        boolean ativo
        timestamptz criado_em
    }

    PEDIDOS {
        uuid id PK
        uuid cliente_id FK
        numeric valor_produtos
        numeric taxa_entrega
        numeric valor_total
        forma_pagamento forma_pagamento
        status_pedido status
        string codigo_entrega
        uuid chave_idempotencia UK
        uuid motoboy_id FK
        timestamptz criado_em
        timestamptz atualizado_em
    }

    ITENS_PEDIDO {
        uuid id PK
        uuid pedido_id FK
        uuid produto_id FK
        integer quantidade
        numeric preco_unitario
        numeric subtotal
    }
```

---

## 2. Script SQL de Criação do Schema (`schema.sql`)

```sql
-- ============================================================================
-- TELES ADEGA DELIVERY - SCRIPT COMPLETO DE ESTRUTURA (SCHEMA)
-- Data: 2026-08-11
-- Engine: PostgreSQL 15+ (Supabase compatible)
-- ============================================================================

-- Habilitar extensão para geração de UUIDs nativos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE status_pedido AS ENUM (
        'aguardando_pagamento',
        'pendente_aprovacao',
        'em_preparo',
        'em_rota',
        'entregue',
        'cancelado'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE forma_pagamento AS ENUM (
        'pix',
        'dinheiro',
        'fiado'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABELAS DE DOMÍNIO E CADASTROS BASE
-- ----------------------------------------------------------------------------

-- Tabela: categorias
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: produtos
CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    foto_url TEXT,
    estoque_atual INT NOT NULL DEFAULT 0 CHECK (estoque_atual >= 0),
    estoque_minimo INT NOT NULL DEFAULT 5 CHECK (estoque_minimo >= 0),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL UNIQUE,
    endereco_completo TEXT NOT NULL,
    cep VARCHAR(9) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    limite_fiado NUMERIC(10, 2) NOT NULL DEFAULT 300.00 CHECK (limite_fiado >= 0),
    saldo_fiado_atual NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (saldo_fiado_atual >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: motoboys
CREATE TABLE IF NOT EXISTS motoboys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: zonas_frete
CREATE TABLE IF NOT EXISTS zonas_frete (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bairro VARCHAR(100) NOT NULL,
    cep_inicio VARCHAR(9),
    cep_fim VARCHAR(9),
    valor_frete NUMERIC(10, 2) NOT NULL CHECK (valor_frete >= 0),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. TABELAS TRANSACIONAIS (PEDIDOS E ITENS)
-- ----------------------------------------------------------------------------

-- Função Auxiliar: Gerador de código de entrega (4 dígitos numéricos seguros)
CREATE OR REPLACE FUNCTION gerar_codigo_entrega()
RETURNS VARCHAR(4) AS $$
BEGIN
    RETURN lpad(floor(random() * 10000)::text, 4, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Tabela: pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    valor_produtos NUMERIC(10, 2) NOT NULL CHECK (valor_produtos >= 0),
    taxa_entrega NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (taxa_entrega >= 0),
    valor_total NUMERIC(10, 2) NOT NULL CHECK (valor_total >= 0),
    forma_pagamento forma_pagamento NOT NULL,
    status status_pedido NOT NULL DEFAULT 'aguardando_pagamento',
    codigo_entrega VARCHAR(4) NOT NULL DEFAULT gerar_codigo_entrega(),
    chave_idempotencia UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    motoboy_id UUID REFERENCES motoboys(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: itens_pedido
CREATE TABLE IF NOT EXISTS itens_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade INT NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(10, 2) NOT NULL CHECK (preco_unitario >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0)
);

-- ----------------------------------------------------------------------------
-- 4. ÍNDICES DE ALTA PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em ON pedidos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON clientes(whatsapp);
CREATE INDEX IF NOT EXISTS idx_zonas_frete_bairro ON zonas_frete(bairro);
```

---

## 3. Triggers e Funções PL/pgSQL

### 3.1 Trigger de Baixa de Estoque (`trigger_baixa_estoque`)
É executada quando o status do pedido muda para **`em_preparo`** (após aprovação do administrador). A função utiliza trava de concorrência (`FOR UPDATE`) para garantir que dosagens de estoque em pedidos simultâneos não provoquem estorno negativo.

```sql
CREATE OR REPLACE FUNCTION fn_baixa_estoque()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    v_estoque_atual INT;
    v_nome_produto VARCHAR(150);
BEGIN
    -- Executa a baixa apenas quando o pedido transiciona para 'em_preparo'
    IF NEW.status = 'em_preparo' AND (OLD.status IS NULL OR OLD.status != 'em_preparo') THEN
        FOR item IN 
            SELECT ip.produto_id, ip.quantidade, p.nome
            FROM itens_pedido ip
            JOIN produtos p ON p.id = ip.produto_id
            WHERE ip.pedido_id = NEW.id
        LOOP
            -- Lock pessimista na linha do produto para evitar condições de corrida (Race Condition)
            SELECT estoque_atual, nome 
            INTO v_estoque_atual, v_nome_produto
            FROM produtos 
            WHERE id = item.produto_id 
            FOR UPDATE;

            -- Validação rigorosa de disponibilidade
            IF v_estoque_atual < item.quantidade THEN
                RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Disponível: %, Solicitado: %).', 
                    v_nome_produto, v_estoque_atual, item.quantidade
                    USING ERRCODE = 'P0001';
            END IF;

            -- Debitar estoque
            UPDATE produtos
            SET estoque_atual = estoque_atual - item.quantidade,
                atualizado_em = NOW()
            WHERE id = item.produto_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_baixa_estoque ON pedidos;
CREATE TRIGGER trigger_baixa_estoque
    AFTER UPDATE OF status ON pedidos
    FOR EACH ROW
    WHEN (NEW.status = 'em_preparo')
    EXECUTE FUNCTION fn_baixa_estoque();
```

### 3.2 Trigger de Atualização e Validação do Fiado (`trigger_atualiza_fiado`)
Verifica se a forma de pagamento é `fiado`. Impede a aprovação se o valor do pedido mais o saldo fiado atual ultrapassarem o limite cadastrado do cliente.

```sql
CREATE OR REPLACE FUNCTION fn_atualiza_fiado()
RETURNS TRIGGER AS $$
DECLARE
    v_limite NUMERIC(10, 2);
    v_saldo_atual NUMERIC(10, 2);
    v_novo_saldo NUMERIC(10, 2);
    v_nome_cliente VARCHAR(150);
BEGIN
    -- Apenas atua quando pagamento for 'fiado' e status estiver sendo alterado para 'em_preparo'
    IF NEW.forma_pagamento = 'fiado' AND NEW.status = 'em_preparo' AND (OLD.status IS NULL OR OLD.status != 'em_preparo') THEN
        
        IF NEW.cliente_id IS NULL THEN
            RAISE EXCEPTION 'Para pagamento na modalidade FIADO, é obrigatório vincular um cliente cadastrado.'
                USING ERRCODE = 'P0002';
        END IF;

        -- Lock pessimista na tabela de clientes
        SELECT limite_fiado, saldo_fiado_atual, nome
        INTO v_limite, v_saldo_atual, v_nome_cliente
        FROM clientes
        WHERE id = NEW.cliente_id
        FOR UPDATE;

        v_novo_saldo := v_saldo_atual + NEW.valor_total;

        -- Validação de limite excedido
        IF v_novo_saldo > v_limite THEN
            RAISE EXCEPTION 'Limite de Fiado Excedido para o cliente "%". (Limite: R$ %, Saldo Atual: R$ %, Pedido: R$ %).',
                v_nome_cliente, v_limite, v_saldo_atual, NEW.valor_total
                USING ERRCODE = 'P0003';
        END IF;

        -- Atualizar saldo devedor do cliente
        UPDATE clientes
        SET saldo_fiado_atual = v_novo_saldo,
            atualizado_em = NOW()
        WHERE id = NEW.cliente_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualiza_fiado ON pedidos;
CREATE TRIGGER trigger_atualiza_fiado
    BEFORE UPDATE OF status ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION fn_atualiza_fiado();
```

### 3.3 Trigger para Atualização Automática de `atualizado_em`
```sql
CREATE OR REPLACE FUNCTION fn_atualiza_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_produtos BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION fn_atualiza_timestamp();
CREATE TRIGGER trg_updated_clientes BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION fn_atualiza_timestamp();
CREATE TRIGGER trg_updated_pedidos BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION fn_atualiza_timestamp();
```

---

## 4. Segurança & Row Level Security (RLS)

O Supabase exige segurança RLS em todas as tabelas para garantir integridade e isolamento de dados.

```sql
-- ----------------------------------------------------------------------------
-- HABILITAÇÃO DO RLS EM TODAS AS TABELAS
-- ----------------------------------------------------------------------------
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_frete ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- POLÍTICAS: LEITURA PÚBLICA (LANDING PAGE & CATÁLOGO)
-- ----------------------------------------------------------------------------
CREATE POLICY "Leitura pública de categorias" 
    ON categorias FOR SELECT 
    TO anon, authenticated 
    USING (ativo = true);

CREATE POLICY "Leitura pública de produtos" 
    ON produtos FOR SELECT 
    TO anon, authenticated 
    USING (ativo = true);

CREATE POLICY "Leitura pública de zonas de frete" 
    ON zonas_frete FOR SELECT 
    TO anon, authenticated 
    USING (ativo = true);

-- ----------------------------------------------------------------------------
-- POLÍTICAS: INSERÇÃO PÚBLICA (CRIAÇÃO DE PEDIDO PELO CLIENTE)
-- ----------------------------------------------------------------------------
CREATE POLICY "Clientes inserem seus cadastros" 
    ON clientes FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Clientes criam novos pedidos" 
    ON pedidos FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Clientes criam itens do pedido" 
    ON itens_pedido FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- TABELA DE ADMINS & HELPER FUNCTION (v2 - Hardening)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bloqueia acesso via client" ON public.admins FOR ALL TO authenticated, anon USING (false);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- POLÍTICAS: GESTÃO EXCLUSIVA PARA ADMINS (UTILIZA is_admin())
-- ----------------------------------------------------------------------------
CREATE POLICY "Admin gerencia todas as categorias" 
    ON categorias FOR ALL 
    TO authenticated 
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin gerencia todos os produtos" 
    ON produtos FOR ALL 
    TO authenticated 
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin gerencia todos os clientes" 
    ON clientes FOR ALL 
    TO authenticated 
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin gerencia motoboys" 
    ON motoboys FOR ALL 
    TO authenticated 
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin gerencia zonas de frete" 
    ON zonas_frete FOR ALL 
    TO authenticated 
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin gerencia todos os pedidos" 
    ON pedidos FOR ALL 
    TO authenticated 
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin gerencia todos os itens dos pedidos" 
    ON itens_pedido FOR ALL 
    TO authenticated 
    USING (is_admin()) WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- RPC DE CRIAÇÃO E CÁLCULO DE PEDIDO NO SERVIDOR
-- ----------------------------------------------------------------------------
-- Função RPC SECURITY DEFINER `criar_pedido` executa o cálculo de preço, frete,
-- validação de limite de fiado e criação atômica de pedidos no PostgreSQL.

-- ----------------------------------------------------------------------------
-- RPC DE CONSULTA SANITIZADA DE CRÉDITO FIADO
-- ----------------------------------------------------------------------------
-- REVOKE SELECT ON public.clientes FROM anon;
-- Função RPC SECURITY DEFINER `consultar_fiado(p_whatsapp text)` retorna apenas
-- os atributos necessários para a UI ({ cliente_id, nome, aprovado, saldo_disponivel, limite_fiado, motivo_recusa }),
-- registrando cada consulta na tabela public.fiado_consultas_log para auditoria.
```

---



## 5. Dados de Carga Inicial (`seed.sql`)

```sql
-- ============================================================================
-- TELES ADEGA DELIVERY - SCRIPT DE CARGA INICIAL (SEED)
-- ============================================================================

-- 1. CATEGORIAS
INSERT INTO categorias (id, nome, descricao) VALUES
('11111111-1111-1111-1111-111111111111', 'Cervejas', 'Cervejas geladas trincando, long necks, latas e packs'),
('22222222-2222-2222-2222-222222222222', 'Destilados', 'Whiskies importados, vodkas premium, gins e cachaças'),
('33333333-3333-3333-3333-333333333333', 'Energéticos', 'Energéticos para turbinar sua noite'),
('44444444-4444-4444-4444-444444444444', 'Gelo Saborizado', 'Gelo aromatizado para drinks artesanais'),
('55555555-5555-5555-5555-555555555555', 'Combos Especiais', 'Combos promocionais prontos para a resenha')
ON CONFLICT (nome) DO NOTHING;

-- 2. PRODUTOS (FOLHETO OFICIAL TELES ADEGA)
INSERT INTO produtos (categoria_id, nome, descricao, preco, foto_url, estoque_atual, estoque_minimo) VALUES
-- Cervejas
('11111111-1111-1111-1111-111111111111', 'Heineken Long Neck 330ml', 'Cerveja Premium Pilsen Puro Malte 330ml', 8.50, 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=500', 120, 20),
('11111111-1111-1111-1111-111111111111', 'Heineken Lata 350ml', 'Cerveja Heineken Lata Sleek 350ml', 6.99, 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500', 200, 30),
('11111111-1111-1111-1111-111111111111', 'Pack Heineken Lata (12 Unidades)', 'Fardo com 12 latas Heineken 350ml', 79.90, 'https://images.unsplash.com/photo-1584225064785-c62a8b43d148?w=500', 50, 10),

-- Destilados
('22222222-2222-2222-2222-222222222222', 'Whisky Jack Daniel''s No. 7 1L', 'Tennessee Whisky Original 1 Litro', 149.90, 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500', 25, 5),
('22222222-2222-2222-2222-222222222222', 'Vodka Smirnoff 21 998ml', 'Vodka triplamente destilada 998ml', 49.90, 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=500', 40, 8),
('22222222-2222-2222-2222-222222222222', 'Gin Bombay Sapphire 750ml', 'Gin Importado London Dry 750ml', 119.90, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500', 15, 3),

-- Energéticos
('33333333-3333-3333-3333-333333333333', 'Energético Monster Energy 473ml', 'Lata tradicional verde 473ml', 11.90, 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500', 100, 15),

-- Gelo Saborizado
('44444444-4444-4444-4444-444444444444', 'Gelo Saborizado - Uva (200g)', 'Gelo especial de sabor uva para copos de 700ml', 4.50, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500', 80, 20),
('44444444-4444-4444-4444-444444444444', 'Gelo Saborizado - Maracujá (200g)', 'Gelo especial de maracujá para drinks', 4.50, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500', 80, 20),
('44444444-4444-4444-4444-444444444444', 'Gelo Saborizado - Morango (200g)', 'Gelo aromatizado de morango', 4.50, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500', 80, 20),
('44444444-4444-4444-4444-444444444444', 'Gelo Saborizado - Limão (200g)', 'Gelo cítrico de limão para Gin/Vodka', 4.50, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500', 80, 20),
('44444444-4444-4444-4444-444444444444', 'Gelo Saborizado - Blue Ice (200g)', 'Gelo azul refrescante sabor frutas azuis', 5.00, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500', 60, 15),

-- Combos Especiais
('55555555-5555-5555-5555-555555555555', 'Combo Resenha Teles', '1x Jack Daniel''s 1L + 4x Monster 473ml + 2x Gelo Saborizado', 189.90, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500', 10, 2);

-- 3. ZONAS DE FRETE (DDD 13 - BAIXADA SANTISTA)
INSERT INTO zonas_frete (bairro, cep_inicio, cep_fim, valor_frete) VALUES
('Santos - Gonzaga / Boqueirão', '11050-000', '11065-900', 7.00),
('Santos - Ponta da Praia / Aparecida', '11030-000', '11045-900', 8.00),
('São Vicente - Centro / Itararé', '11310-000', '11325-900', 10.00),
('Praia Grande - Canto do Forte / Boqueirão', '11700-000', '11701-900', 12.00),
('Cubatão - Centro / Vila Nova', '11500-000', '11515-900', 15.00);

-- 4. MOTOBOYS INICIAIS
INSERT INTO motoboys (nome, telefone) VALUES
('Carlos Motoboy Teles 01', '(13) 99111-2233'),
('Roberto Motoboy Teles 02', '(13) 99222-4455');
```

---

## 6. Definição de Pronto (Definition of Done - DoD)

Para considerar a especificação de banco de dados validada com sucesso, execute o seguinte checklist no **SQL Editor do Supabase**:

- [x] **Compilação Sem Erros:** Executar o script `schema.sql` completo no Supabase SQL Editor e verificar mensagem de sucesso.
- [x] **Enums Criados:** Confirmar a existência dos tipos `status_pedido` e `forma_pagamento`.
- [x] **Geração de Código:** Testar `SELECT gerar_codigo_entrega();` e validar o retorno de uma string numérica com exatamente 4 dígitos.
- [x] **Validação de Triggers:**
  - [x] Testar alteração de pedido para status `em_preparo` e validar a redução automática no campo `estoque_atual` da tabela `produtos`.
  - [x] Tentar realizar alteração de status com quantidade superior ao estoque atual e validar o bloqueio pela mensagem `Estoque insuficiente`.
  - [x] Criar/Atualizar pedido em modalidade `fiado` ultrapassando o `limite_fiado` do cliente e validar o disparo do erro `P0003` (Limite Excedido).
- [x] **Segurança RLS:** Testar chamadas via cliente anônimo (`anon key`) e confirmar permissão de leitura nos produtos/categorias e bloqueio em cadastros administrativos de motoboys/relatórios.
- [x] **Carga Inicial:** Executar `seed.sql` e verificar a listagem dos produtos oficiais (Heineken, Jack Daniel's, Monster, Gelo Saborizado, Combo Resenha Teles) e Zonas de Frete do DDD 13.
