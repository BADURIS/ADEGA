# 🍷 TELES ADEGA DELIVERY — Sistema de E-Commerce & Delivery em Tempo Real

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%2015-emerald?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Security](https://img.shields.io/badge/Security-8--Phase%20Hardening%20Passed-brightgreen)](./SECURITY-HARDENING-CHANGELOG.md)

Sistema moderno, responsivo e ultra-seguro para e-commerce de delivery de bebidas e adegas (DDD 13 - Baixada Santista). Contempla vitrine para clientes, checkout em tempo real, painel Kanban administrativo com atualizações via WebSocket (Realtime), aplicativo de acerto de caixa para motoboys, automação de mensagens no WhatsApp via n8n + Evolution API e blindagem completa de segurança contra fraudes.

---

## 🛡️ Pacote Completo de Hardening de Segurança (8 Fases Implementadas)

O projeto passou por uma auditoria e rearquitetura completa de segurança para produção real (Pix, Dinheiro, Fiado):

1. **Modelo de Papéis & RLS Administrador (`is_admin()`)**:
   - Tabela `public.admins` com isolamento absoluto.
   - Função `public.is_admin()` (`SECURITY DEFINER`) validando acessos administrativos nas RLS Policies.
   - Middleware do Next.js bloqueando rotas `/admin/*` via consulta Supabase RPC.
2. **Cálculo de Preço 100% no Servidor**:
   - Função RPC `public.criar_pedido(...)` no PostgreSQL com trava transacional pessimista (`FOR UPDATE`).
   - Recálculo de unitários, subtotais e frete da zona direto na tabela `produtos`.
   - Remoção da permissão de `INSERT` direto via cliente (`anon` / `authenticated`).
   - Modal de confirmação no checkout para divergência de preços atualizados em tempo real.
3. **Validação Transacional de Crédito Fiado & Sanitização PII**:
   - Função RPC `public.consultar_fiado(...)` retornando apenas payload sanitizado.
   - Validação de limite de crédito fiado no servidor com trava de concorrência (`FOR UPDATE`).
   - Revogação de acesso público a dados de clientes (`REVOKE SELECT ON clientes FROM anon`).
4. **Webhook do Mercado Pago (Closed-Failure)**:
   - Resposta imediata HTTP 500 em produção se segredos não estiverem configurados.
   - Algoritmo estrito de checagem HMAC-SHA256 (`x-signature`).
   - Consulta obrigatória à API oficial do Mercado Pago (`GET /v1/payments/{id}`).
   - Validação de divergência do valor transacionado (`transaction_amount` vs `valor_total`).
5. **Proteção do Webhook de Alerta de Estoque**:
   - Autenticação via header `x-internal-webhook-secret` com comparação em tempo constante (`crypto.timingSafeEqual`).
   - Remoção de números de WhatsApp hardcoded do código-fonte público.
6. **Módulo Admin Sem Fallback Silencioso**:
   - Helper centralizado `src/lib/supabaseAdmin.ts` lançando exceção explícita no boot se `SUPABASE_SERVICE_ROLE_KEY` estiver ausente.
7. **Rate Limiting Distribuído**:
   - Motor `src/lib/rateLimit.ts` e Route Handler `/api/ratelimit` com janela deslizante (Upstash Redis REST API + fallback em memória).
   - Bloqueio por IP/identificador para Login Admin (5/15min), Checkout (5/10min) e Fiado (10/5min).
8. **Higiene de Logs (LGPD)**:
   - Utilitário `src/lib/logUtils.ts` com mascaramento automático de telefones (`13997***605`), e-mails e sanitização de segredos em observabilidade.

---

## ⚡ Stack Tecnológica

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5.4.
- **Estilização:** Vanilla CSS & Tailwind CSS (Dark Mode & Gold Palette: `#0D0D0D`, `#161616`, `#262626`, `#F59E0B`, `#22C55E`).
- **Estado Global:** Zustand (Store reativa `useCartStore` com persistência em localStorage).
- **Backend & Banco de Dados:** Supabase (PostgreSQL 15+, Row Level Security, WebSockets Realtime, Storage).
- **Rate Limiting:** Upstash Redis HTTP REST API / Memory LRU Sliding Window.
- **Validação & Formulários:** Zod + React Hook Form.
- **Integrações & Automação:** Mercado Pago API (Pix Payments), n8n Workflow Orchestrator, Evolution API (WhatsApp Gateway), Leaflet (Mapas de Entrega).

---

## 📁 Estrutura do Projeto

```
teles-adega-delivery/
├── public/                     # Assets estáticos (logos, favicons, imagens)
├── src/
│   ├── app/                    # Next.js App Router Pages & API Routes
│   │   ├── (storefront)/       # Vitrine pública (/)
│   │   ├── checkout/           # Checkout seguro com validação RPC e modal de divergência
│   │   ├── pedido/[id]/        # Acompanhamento do pedido em tempo real com stepper
│   │   ├── motoboy/            # Interface móvel para entregadores
│   │   ├── admin/              # Painel Administrativo
│   │   │   ├── login/          # Autenticação com rate-limiting
│   │   │   ├── dashboard/      # Métricas e gráficos gerais
│   │   │   ├── kanban/         # Kanban de pedidos em tempo real com alert som
│   │   │   ├── produtos/       # Gestão de catálogo e estoque
│   │   │   ├── entregas/       # Controle de rotas e motoboys
│   │   │   ├── caixa/          # Fechamento financeiro de caixa
│   │   │   └── relatorios/     # Relatórios de vendas e exportação CSV
│   │   └── api/                # Route Handlers e Webhooks protegidos
│   │       ├── ratelimit/      # Endpoint de rate limiting deslizante
│   │       └── webhooks/
│   │           ├── mercadopago/# Webhook do Mercado Pago Pix (Falhar Fechado)
│   │           └── stock-alert/# Webhook de alerta de estoque crítico
│   ├── components/             # Componentes React desacoplados e reutilizáveis
│   │   ├── admin/              # Componentes do painel administrativo
│   │   ├── checkout/           # Formulários e seletores do checkout
│   │   ├── layout/             # Header, Navigation, CartDrawer
│   │   ├── order/              # Rastreamento e mapa de entregas (Leaflet)
│   │   └── storefront/         # Cards de produtos, grids e banners
│   ├── hooks/                  # Custom React Hooks (Realtime, AudioAlert, Hydration)
│   ├── lib/                    # Helpers centrais (supabaseAdmin, rateLimit, logUtils)
│   ├── services/               # Clientes de API (Supabase Client, ViaCEP)
│   ├── store/                  # Stores globais Zustand (useCartStore)
│   └── types/                  # Definições TypeScript (Storefront, Checkout, Motoboy)
├── supabase/
│   └── migrations/             # SQL Migrations versionadas (001, 002)
├── SPEC-01-DATABASE.md         # Especificação Técnica de Banco de Dados & ERD
├── SPEC-02-STOREFRONT.md       # Especificação do Cliente & Checkout
├── SPEC-03-ADMIN-KANBAN.md     # Especificação do Painel Operacional
├── SPEC-04-INTEGRATIONS-N8N.md # Especificação de Automações WhatsApp & Pix
├── SPEC-06-ADVANCED-FEATURES.md# Especificação de Recursos Avançados
└── SECURITY-HARDENING-CHANGELOG.md # Relatório técnico de auditoria e hardening
```

---

## 🛠️ Como Executar Localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/BADURIS/ADEGA.git
cd ADEGA
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env.local` na raiz com base no `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

MERCADO_PAGO_ACCESS_TOKEN=seu-access-token
MERCADO_PAGO_WEBHOOK_SECRET=seu-webhook-secret

INTERNAL_WEBHOOK_SECRET=seu-segredo-interno-webhook
ADMIN_WHATSAPP_NUMBER=5511999999999


UPSTASH_REDIS_REST_URL=https://seu-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=seu-upstash-token
```

### 4. Executar em modo de desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000` para a vitrine e `http://localhost:3000/admin/login` para o painel administrativo.

---

## 🧪 Validação & Build

Para checar a integridade do código e gerar a build otimizada de produção:

```bash
# Executar linter (ESLint)
npm run lint

# Compilar build de produção Next.js
npm run build
```

---

## 📝 Licença

Projeto privado desenvolvido para a **Teles Adega Delivery**. Todos os direitos reservados.
