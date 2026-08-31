# 📄 SPEC-04-INTEGRATIONS-N8N: Especificação Técnica de Automações, Pagamentos Pix (Mercado Pago) e WhatsApp (n8n + Evolution API)

**Projeto:** TELES ADEGA DELIVERY  
**DDD / Região:** (13) - Baixada Santista  
**Contato / WhatsApp Oficial:** (13) 99765-0605 | Instagram [@teles.adegadelivery](https://instagram.com/teles.adegadelivery)  
**Stack de Integrações:** Next.js 14/15 (App Router), Supabase (Database, Auth, Database Webhooks), Mercado Pago API v1 (Pix Payments & Webhooks), n8n (Self-hosted Workflow Orchestrator), Evolution API v2 (WhatsApp Baileys Gateway), Node.js Crypto (HMAC SHA256), Zod Validation  
**Autor:** Engenheiro de Software Sênior (Backend, Payments & Automations Specialist)  
**Versão:** 1.0.0  
**Data:** 11/08/2026  

---

## 1. Arquitetura Geral de Integração & Webhooks

O ecossistema de automações e pagamentos do **TELES ADEGA DELIVERY** une o processamento financeiro instantâneo em tempo real via **Mercado Pago API (Pix)** com o disparo reativo e assíncrono de notificações de pedido via **WhatsApp**, utilizando o **n8n (Self-hosted)** e a **Evolution API (v2 / Engine Baileys)**.

### 1.1 Princípios de Arquitetura & Resiliência

1. **Idempotência Operacional:** Todas as transações financeiras e requisições de webhook carregam chave de idempotência (`X-Idempotency-Key`) para prevenir duplicidade de cobrança em repetições de requisições de rede.
2. **Zero Confiança em Webhooks Recebidos (Anti-Spoofing):** Webhooks recebidos do gateway de pagamento **nunca** alteram o estado do banco de dados baseando-se apenas no payload recebido. O Next.js valida o cabeçalho criptográfico `x-signature` e realiza uma **Consulta Ativa de Confirmação (GET /v1/payments/{id})** diretamente na API oficial do Mercado Pago antes de atualizar o pedido.
3. **Desacoplamento Assíncrono:** O servidor Web (Next.js) responde aos webhooks e finalizações de pedido em tempo hábil (< 200ms) e delega o processamento de notificações ao **n8n** através de chamadas HTTP não-bloqueantes ou Database Webhooks do Supabase.
4. **Retry Ativo & Redundância:** Caso a Evolution API ou o WhatsApp apresentem instabilidade, o n8n executa política de tentativas (`Retry on Fail`: 3 tentativas com backoff exponencial) e registra logs de erro no Supabase (`logs_integracao`).

---

### 1.2 Diagrama Completo de Comunicação Reativa (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Cliente (Storefront)
    participant Next as Next.js App Router (Server API)
    participant MP as Mercado Pago API
    participant DB as Supabase PostgreSQL
    participant N8N as n8n Orchestrator
    participant Evo as Evolution API (WhatsApp)
    actor Admin as Admin (Kanban Panel)

    %% Flow 1: Checkout & Pix Generation
    Cliente->>Next: 1. Finalizar Pedido (POST /api/checkout)
    Next->>DB: 2. INSERT INTO pedidos (status='pendente', codigo_confirmacao='4829')
    Next->>MP: 3. POST /v1/payments (Pix payload + X-Idempotency-Key)
    MP-->>Next: 4. Payment Created (QR Code Base64 + Pix Copia e Cola)
    Next-->>Cliente: 5. Retorna Dados Pix para Renderização no Modal
    
    %% Flow 2: Payment Confirmation & Webhook Anti-Spoofing
    MP->>Next: 6. Webhook POST /api/webhooks/mercadopago (x-signature, data.id)
    Next->>Next: 7. Valida HMAC SHA-256 (x-signature)
    Next->>MP: 8. Consulta Ativa GET /v1/payments/{id} (Bearer Token)
    MP-->>Next: 9. Retorna Status Real ('approved')
    Next->>DB: 10. UPDATE pedidos SET status_pagamento='pago', status='em_preparo'
    DB-->>Admin: 11. Realtime Broadcast (Alerta Novo Pedido no Kanban)
    
    %% Flow 3: n8n Order Received Notification Workflow
    Next->>N8N: 12. Trigger Webhook POST /webhook/order-created (Payload Pedido)
    N8N->>Evo: 13. POST /message/sendText/teles-adega (WhatsApp Cliente)
    Evo-->>Cliente: 14. 📲 "Seu pedido #1042 foi recebido! Código: 4829"

    %% Flow 4: Dispatch & Motoboy Workflow
    Admin->>DB: 15. UPDATE pedidos SET status='em_rota', motoboy_id='uuid'
    DB->>N8N: 16. Supabase Database Webhook (Trigger status='em_rota')
    N8N->>Evo: 17. POST /message/sendText/teles-adega (WhatsApp Cliente)
    Evo-->>Cliente: 18. 📲 "Seu pedido saiu para entrega com o Motoboy Carlos! Tenha o código 4829 em mãos."

    %% Flow 5: Delivery Completed Workflow
    Admin->>DB: 19. UPDATE pedidos SET status='entregue' (Validação OTP 4 dígitos)
    DB->>N8N: 20. Supabase Database Webhook (Trigger status='entregue')
    N8N->>Evo: 21. POST /message/sendText/teles-adega (WhatsApp Cliente)
    Evo-->>Cliente: 22. 📲 "Pedido entregue com sucesso! Siga-nos no IG @teles.adegadelivery"
```

---

### 1.3 Mapeamento de Credenciais e Variáveis de Ambiente (`.env.production`)

```env
# Mercado Pago Credentials
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-7894561230123456-081121-xxxxxx..."
MERCADO_PAGO_PUBLIC_KEY="APP_USR-9876543210987654-xxxxxx..."
MERCADO_PAGO_WEBHOOK_SECRET="7a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b"

# Storefront & Webhook URLs
NEXT_PUBLIC_APP_URL="https://adegateles.com.br"
MERCADO_PAGO_WEBHOOK_URL="https://adegateles.com.br/api/webhooks/mercadopago"

# n8n Automation Engine Credentials
N8N_BASE_URL="https://n8n.adegateles.com.br"
N8N_WEBHOOK_SECRET_TOKEN="n8n_sec_teles_adega_997650605_x89z"
INTERNAL_WEBHOOK_SECRET="int_sec_teles_adega_stock_77123"

# Evolution API / WhatsApp Engine
EVOLUTION_API_BASE_URL="https://wa.adegateles.com.br"
EVOLUTION_API_KEY="evo_key_teles_adega_prod_88123"
EVOLUTION_INSTANCE_NAME="teles-adega"
OFFICIAL_WHATSAPP_NUMBER="5511999999999"
ADMIN_WHATSAPP_NUMBER="5511999999999"
```



---

## 2. Geração de Cobrança Pix & Webhooks (Mercado Pago API)

### 2.1 Endpoint e Payload de Criação de Pagamento Pix

Para gerar uma cobrança Pix no checkout, o backend Next.js consome o endpoint oficial de pagamentos do Mercado Pago (`v1/payments`).

- **Endpoint:** `POST https://api.mercadopago.com/v1/payments`
- **Headers HTTP:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {MERCADO_PAGO_ACCESS_TOKEN}`
  - `X-Idempotency-Key: {pedido_id}` *(Garante que requisições repetidas retornem a mesma cobrança sem gerar Pix duplicado)*

#### Payload de Requisição (JSON enviada pelo Next.js ao Mercado Pago):

```json
{
  "transaction_amount": 142.90,
  "description": "Pedido #1042 - Teles Adega Delivery",
  "payment_method_id": "pix",
  "external_reference": "b8a21f45-0912-4c28-98e1-5120a1c78ef4",
  "notification_url": "https://adegateles.com.br/api/webhooks/mercadopago",
  "payer": {
    "email": "joao.silva@email.com",
    "first_name": "João",
    "last_name": "Silva",
    "identification": {
      "type": "CPF",
      "number": "12345678909"
    },
    "phone": {
      "area_code": "13",
      "number": "998877665"
    }
  },
  "metadata": {
    "pedido_id": "b8a21f45-0912-4c28-98e1-5120a1c78ef4",
    "numero_pedido": 1042,
    "origem": "storefront_web"
  }
}
```

---

### 2.2 Payload de Resposta e Extração do Pix

O Mercado Pago retorna os dados da transação contendo os atributos `point_of_interaction.transaction_data`, de onde o sistema extrai o QR Code em imagem Base64 e a string de Copia e Cola (`emv/qr_code`).

#### Payload de Resposta (Mercado Pago HTTP 201 Created):

```json
{
  "id": 8945120394,
  "date_created": "2026-08-11T21:15:30.000-04:00",
  "date_of_expiration": "2026-08-11T21:45:30.000-04:00",
  "status": "pending",
  "status_detail": "pending_waiting_transfer",
  "payment_method_id": "pix",
  "transaction_amount": 142.90,
  "external_reference": "b8a21f45-0912-4c28-98e1-5120a1c78ef4",
  "point_of_interaction": {
    "type": "PIX",
    "transaction_data": {
      "qr_code": "00020126580014br.gov.bcb.pix0136b8a21f45-0912-4c28-98e1-5120a1c78ef45204000053039865406142.905802BR5919TELES ADEGA DELIVERY6013PRAIA GRANDE62070503***6304E8A1",
      "qr_code_base64": "iVBORw0KGgoAAAANSUhEUgAAAUAAAAFACAYAAAC19w16AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAABZJJREFUeJzs3c..."
    }
  }
}
```

#### Código de Integração no Next.js (`src/lib/payments/mercadopago.ts`):

```typescript
import { z } from 'zod'

const MercadoPagoPixResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
  external_reference: z.string(),
  point_of_interaction: z.object({
    transaction_data: z.object({
      qr_code: z.string(),
      qr_code_base64: z.string()
    })
  })
})

export interface CreatePixParams {
  pedidoId: string
  numeroPedido: number
  valorTotal: number
  cliente: {
    nome: string
    cpf: string
    email?: string
    telefone: string
  }
}

export async function gerarCobrancaPixMercadoPago(params: CreatePixParams) {
  const url = 'https://api.mercadopago.com/v1/payments'
  
  const payload = {
    transaction_amount: params.valorTotal,
    description: `Pedido #${params.numeroPedido} - Teles Adega Delivery`,
    payment_method_id: 'pix',
    external_reference: params.pedidoId,
    notification_url: process.env.MERCADO_PAGO_WEBHOOK_URL,
    payer: {
      email: params.cliente.email || 'contato@adegateles.com.br',
      first_name: params.cliente.nome.split(' ')[0],
      last_name: params.cliente.nome.split(' ').slice(1).join(' ') || 'Cliente',
      identification: {
        type: 'CPF',
        number: params.cliente.cpf.replace(/\D/g, '')
      }
    },
    metadata: {
      pedido_id: params.pedidoId,
      numero_pedido: params.numeroPedido
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
      'X-Idempotency-Key': params.pedidoId
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error('[MercadoPago] Erro ao gerar Pix:', errorData)
    throw new Error(`Falha ao gerar Pix Mercado Pago: ${errorData.message || response.statusText}`)
  }

  const rawData = await response.json()
  const validatedData = MercadoPagoPixResponseSchema.parse(rawData)

  return {
    paymentId: validatedData.id,
    status: validatedData.status,
    qrCodeCopiaECola: validatedData.point_of_interaction.transaction_data.qr_code,
    qrCodeBase64: validatedData.point_of_interaction.transaction_data.qr_code_base64
  }
}
```

---

### 2.3 Webhook de Confirmação de Pagamento (`POST /api/webhooks/mercadopago`)

Quando o cliente conclui a transferência Pix no app do banco dele, o Mercado Pago envia uma notificação `POST` para o servidor do Teles Adega Delivery.

#### Validação de Segurança Anti-Spoofing via `x-signature`

O cabeçalho `x-signature` possui a estrutura: `ts=1770851730,v1=9b21f...`.
A validação é feita via HMAC-SHA256 comparando a assinatura gerada com a chave `MERCADO_PAGO_WEBHOOK_SECRET`.

```
Template da String para HMAC:
manifest_id = "id:" + data_id + ";request-id:" + x_request_id + ";ts:" + ts + ";"
```

#### Código Completo da Route Handler (`src/app/api/webhooks/mercadopago/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Supabase Admin Client (Bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verificarAssinaturaMercadoPago(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null
): boolean {
  if (!xSignature || !xRequestId || !dataId) return false

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!
  const parts = xSignature.split(',')
  let ts = ''
  let hashV1 = ''

  for (const part of parts) {
    const [key, val] = part.split('=')
    if (key.trim() === 'ts') ts = val.trim()
    if (key.trim() === 'v1') hashV1 = val.trim()
  }

  if (!ts || !hashV1) return false

  // Monta a string do manifesto exatamente no formato exigido pelo Mercado Pago
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex')

  return hmac === hashV1
}

export async function POST(req: NextRequest) {
  try {
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    
    const body = await req.json()
    const paymentId = body?.data?.id || req.nextUrl.searchParams.get('data.id')
    const action = body?.action || body?.type

    console.log(`[Webhook MercadoPago] Recebido - Action: ${action}, PaymentID: ${paymentId}`)

    // 1. Validação do cabeçalho x-signature
    if (!verificarAssinaturaMercadoPago(xSignature, xRequestId, String(paymentId))) {
      console.warn('[Webhook MercadoPago] Assinatura x-signature inválida ou desformatada. Possível tentativa de fraude!')
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 })
    }

    // Processar apenas eventos de pagamento
    if (action !== 'payment.created' && action !== 'payment.updated' && action !== 'payment') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    // 2. Consulta Ativa de Checagem (GET /v1/payments/{id}) no Mercado Pago API
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
      }
    })

    if (!mpRes.ok) {
      console.error(`[Webhook MercadoPago] Erro ao consultar pagamento ID ${paymentId} na API do MP.`)
      return NextResponse.json({ error: 'Failed to fetch payment status from MP' }, { status: 502 })
    }

    const paymentDetails = await mpRes.json()
    const { status: mpStatus, external_reference: pedidoId, transaction_amount } = paymentDetails

    console.log(`[Webhook MercadoPago] Status Oficial MP para Pedido ${pedidoId}: ${mpStatus}`)

    // 3. Se o pagamento estiver APROVADO, atualiza o pedido no Supabase
    if (mpStatus === 'approved') {
      // Buscar pedido para validação
      const { data: pedido, error: fetchErr } = await supabaseAdmin
        .from('pedidos')
        .select('id, numero_pedido, status, status_pagamento, cliente_nome, cliente_telefone, valor_total, codigo_confirmacao')
        .eq('id', pedidoId)
        .single()

      if (fetchErr || !pedido) {
        console.error(`[Webhook MercadoPago] Pedido ${pedidoId} não encontrado no Supabase.`)
        return NextResponse.json({ error: 'Pedido not found' }, { status: 404 })
      }

      // Evitar re-processamento de pedidos já pagos
      if (pedido.status_pagamento === 'pago') {
        return NextResponse.json({ message: 'Pedido já processado como pago.' }, { status: 200 })
      }

      // Transição de estado e atualização
      const { error: updateErr } = await supabaseAdmin
        .from('pedidos')
        .update({
          status_pagamento: 'pago',
          status: 'em_preparo',
          pago_em: new Date().toISOString(),
          mp_payment_id: String(paymentId)
        })
        .eq('id', pedidoId)

      if (updateErr) {
        console.error(`[Webhook MercadoPago] Erro ao atualizar pedido ${pedidoId}:`, updateErr)
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      // 4. Disparo do Webhook para o n8n iniciar o Workflow 1 (Confirmação de Pedido)
      try {
        await fetch(`${process.env.N8N_BASE_URL}/webhook/order-created`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-n8n-token': process.env.N8N_WEBHOOK_SECRET_TOKEN!
          },
          body: JSON.stringify({
            event: 'order_created',
            pedido: {
              id: pedido.id,
              numero_pedido: pedido.numero_pedido,
              cliente_nome: pedido.cliente_nome,
              cliente_telefone: pedido.cliente_telefone,
              valor_total: pedido.valor_total,
              codigo_confirmacao: pedido.codigo_confirmacao,
              status_pagamento: 'pago',
              metodo_pagamento: 'pix'
            }
          })
        })
      } catch (n8nErr) {
        console.error('[Webhook MercadoPago] Erro ao notificar n8n:', n8nErr)
        // Não falha o webhook do Mercado Pago se o n8n falhar (tolerância a falhas)
      }
    }

    return NextResponse.json({ success: true, paymentId, mpStatus }, { status: 200 })

  } catch (error: any) {
    console.error('[Webhook MercadoPago] Exceção não tratada:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
```

---

## 3. Workflows no n8n (Automações do WhatsApp via Evolution API)

### 3.1 Arquitetura do n8n & Endpoint da Evolution API

O **n8n** (Self-hosted) gerencia os fluxos de mensagens para o WhatsApp conectado à instância `teles-adega` na **Evolution API v2**.

- **URL de Disparo Evolution API:** `POST {EVOLUTION_API_BASE_URL}/message/sendText/{EVOLUTION_INSTANCE_NAME}`
- **Headers HTTP Obrigatórios:**
  - `Content-Type: application/json`
  - `apikey: {EVOLUTION_API_KEY}`

#### Estrutura do Payload Padrão de Envio (Evolution API):

```json
{
  "number": "5513998877665",
  "text": "Mensagem formatada com *negrito*, _itálico_ e quebras de linha.\n\nTeles Adega Delivery 🍷",
  "options": {
    "delay": 1200,
    "presence": "composing",
    "linkPreview": true
  }
}
```

---

### 3.2 Workflow 1: Confirmação de Pedido Realizado (`order-created`)

Este fluxo é acionado quando o pedido é registrado e confirmado no sistema (após pagamento Pix aprovado ou confirmação de pagamento na entrega).

- **Gatilho (Trigger):** Webhook n8n `POST /webhook/order-created`
- **Objetivo:** Notificar o cliente sobre o recebimento do pedido, resumo de valores e o **Código de Confirmação de 4 dígitos** essencial para a entrega.

#### Template da Mensagem WhatsApp (Workflow 1):

```text
🍷 *TELES ADEGA DELIVERY* 🍷
-----------------------------------------
Olá, *{{ $json.pedido.cliente_nome }}*! 👋

Recebemos o seu pedido *#{{ $json.pedido.numero_pedido }}* com sucesso! 🚀

📋 *Resumo do Pedido:*
• Valor Total: *R$ {{ $json.pedido.valor_total.toFixed(2).replace('.', ',') }}*
• Pagamento: *{{ $json.pedido.metodo_pagamento.toUpperCase() }}*
• Status: *Em Preparo*

🔐 *CÓDIGO DE SEGURANÇA PARA ENTREGA:*
👉 *{{ $json.pedido.codigo_confirmacao }}* 👈

⚠️ *Guarde este código!* Você precisará informá-lo ao motoboy no momento da entrega para liberar seus produtos.

Já estamos gelando e preparando suas bebidas! Qualquer dúvida, responda a esta mensagem.
```

#### Diagrama de Nós no n8n (Workflow 1 JSON Logic):

```mermaid
graph LR
    A[Webhook Trigger: /order-created] --> B[Code Node: Formatação de Telefone & Moeda]
    B --> C[HTTP Request: Evolution API sendText]
    C --> D{HTTP Status 200?}
    D -- Sim --> E[Log Sucesso: Supabase logs_integracao]
    D -- Não --> F[Retry Loop: 3x Backoff Exponencial]
    F -- Falha Definitiva --> G[Alert Telegram/Email Admin]
```

#### Especificação de Configuração dos Nós do Workflow 1 (n8n JSON Snippet):

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "order-created",
        "options": {
          "rawBody": false
        }
      },
      "name": "Webhook Order Created",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "jsCode": "const input = $input.first().json.body;\nconst rawPhone = String(input.pedido.cliente_telefone).replace(/\\D/g, '');\nconst formattedPhone = rawPhone.startsWith('55') ? rawPhone : '55' + rawPhone;\nconst formattedTotal = Number(input.pedido.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });\n\nreturn {\n  phone: formattedPhone,\n  nome: input.pedido.cliente_nome,\n  numeroPedido: input.pedido.numero_pedido,\n  valorTotal: formattedTotal,\n  codigoConfirmacao: input.pedido.codigo_confirmacao,\n  metodoPagamento: input.pedido.metodo_pagamento\n};"
      },
      "name": "Format Data & Phone",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [450, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.EVOLUTION_API_BASE_URL }}/message/sendText/{{ $env.EVOLUTION_INSTANCE_NAME }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{ $env.EVOLUTION_API_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"number\": \"{{ $json.phone }}\",\n  \"text\": \"🍷 *TELES ADEGA DELIVERY* 🍷\\n-----------------------------------------\\nOlá, *{{ $json.nome }}*! 👋\\n\\nRecebemos o seu pedido *#{{ $json.numeroPedido }}* com sucesso! 🚀\\n\\n📋 *Resumo do Pedido:*\\n• Valor Total: *{{ $json.valorTotal }}*\\n• Status: *Em Preparo*\\n\\n🔐 *CÓDIGO DE SEGURANÇA PARA ENTREGA:*\\n👉 *{{ $json.codigoConfirmacao }}* 👈\\n\\n⚠️ *Guarde este código!* Você precisará informá-lo ao motoboy no momento em que ele chegar.\"\n}"
      },
      "name": "Send WhatsApp Message",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [680, 300]
    }
  ]
}
```

---

### 3.3 Workflow 2: Pedido Saiu para Entrega (`order-dispatch`)

Este fluxo é ativado automaticamente via **Database Webhook do Supabase** quando um operador altera o status do pedido para `em_rota` no Kanban do Painel Admin.

- **Gatilho (Trigger):** Webhook n8n `POST /webhook/order-dispatch`
- **Payload Recebido:** `pedido_id`, `numero_pedido`, `cliente_nome`, `cliente_telefone`, `motoboy_nome`, `motoboy_telefone`, `codigo_confirmacao`.

#### Template da Mensagem WhatsApp (Workflow 2):

```text
🛵 *SEU PEDIDO SAIU PARA ENTREGA!* 🛵
-----------------------------------------
Olá, *{{ $json.pedido.cliente_nome }}*! ⚡

O seu pedido *#{{ $json.pedido.numero_pedido }}* acabou de sair da Teles Adega e já está a caminho do seu endereço!

🏍️ *Entregador:* {{ $json.pedido.motoboy_nome }}
📞 *Contato Motoboy:* {{ $json.pedido.motoboy_telefone }}

🔑 *RELEMBRANDO SEU CÓDIGO DE 4 DÍGITOS:*
👉 *{{ $json.pedido.codigo_confirmacao }}* 👈

Por favor, esteja com o celular por perto e o código em mãos para agilizar a entrega do seu pedido trincando de gelado! 🧊🍻
```

---

### 3.4 Workflow 3: Notificação de Pedido Concluído (`order-delivered`)

Este fluxo é acionado quando o motoboy valida com sucesso o código de 4 dígitos no aplicativo ou no Kanban Admin, e o pedido transiciona para o status final `entregue`.

- **Gatilho (Trigger):** Webhook n8n `POST /webhook/order-delivered`
- **Payload Recebido:** `numero_pedido`, `cliente_nome`, `cliente_telefone`.

#### Template da Mensagem WhatsApp (Workflow 3):

```text
✅ *PEDIDO ENTREGUE COM SUCESSO!* 🎉
-----------------------------------------
Olá, *{{ $json.pedido.cliente_nome }}*!

Confirmamos a entrega do seu pedido *#{{ $json.pedido.numero_pedido }}*. Agradecemos imensamente a preferência pela *Teles Adega Delivery*! 🍾✨

Aproveite suas bebidas com responsabilidade! 🧊🥂

📸 *Curtiu o atendimento e a agilidade?*
Tire uma foto, nos marque no Instagram e ganhe cupom na próxima compra:
👉 Instagram: *@teles.adegadelivery*
🔗 https://instagram.com/teles.adegadelivery

Tenha um excelente momento e até o próximo pedido! 🚀
```

---

### 3.5 Tratamento de Erros, Retries e Fallback Logs no Supabase

Para assegurar 99.9% de entrega das notificações, a arquitetura n8n implementa um sub-workflow dedicado de tratamento de erros (**Error Trigger**).

#### Fluxo de Retries e Fallback:

```mermaid
flowchart TD
    A[Falha no Envio HTTP Evolution API] --> B{Tentativa < 3?}
    B -- Sim --> C[Wait 5 Segundos + Backoff Exponencial]
    C --> D[Re-executa Nó HTTP Request]
    B -- Não --> E[Dispara Error Trigger Node no n8n]
    E --> F[INSERT INTO logs_integracao no Supabase]
    F --> G[Notifica Admin no Telegram/WhatsApp de Contingência]
```

#### Tabela de Logs de Integração no Supabase (`logs_integracao`):

```sql
CREATE TABLE public.logs_integracao (
    id UUID PRIMARY KEY DEFAULT gen_random_state_v1(),
    servico VARCHAR(50) NOT NULL, -- 'mercadopago', 'n8n', 'evolution_api'
    tipo_evento VARCHAR(100) NOT NULL,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
    status_code INT,
    payload JSONB,
    erro_mensagem TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_integracao_pedido ON public.logs_integracao(pedido_id);
CREATE INDEX idx_logs_integracao_servico ON public.logs_integracao(servico);
```

---

## 4. Definição de Pronto (Definition of Done - DoD)

A especificação e implementação do módulo de Integrações, Mercado Pago e Automações n8n serão consideradas **CONCLUÍDAS** apenas quando todos os itens abaixo forem atingidos e validados:

- [ ] **Integração Mercado Pago API (Pix):**
  - [ ] Endpoint `POST /v1/payments` gera cobrança Pix funcional em ambiente de teste e produção.
  - [ ] Retorno com extração correta de `qr_code_base64` e `qr_code` (Copia e Cola).
  - [ ] Definida política de expiração do Pix para 30 minutos (`date_of_expiration`).
  - [ ] Cabeçalho `X-Idempotency-Key` implementado em todas as requisições financeiras.

- [ ] **Segurança de Webhooks Mercado Pago:**
  - [ ] Route Handler `POST /api/webhooks/mercadopago` criada no Next.js App Router.
  - [ ] Algoritmo de validação HMAC SHA256 do cabeçalho `x-signature` com `MERCADO_PAGO_WEBHOOK_SECRET` 100% funcional.
  - [ ] Rejeição imediata com HTTP status `401 Unauthorized` para requisições com assinatura inválida.
  - [ ] Implementada a **Consulta Ativa de Validação (GET /v1/payments/{id})** via Bearer Token antes de alterar qualquer registro no banco.
  - [ ] Transição de estado automática no Supabase para `status_pagamento = 'pago'` e `status = 'em_preparo'`.

- [ ] **Workflows n8n & Evolution API (WhatsApp):**
  - [ ] Instância `teles-adega` ativa e pareada na Evolution API com o número oficial (13) 99765-0605.
  - [ ] **Workflow 1 (`order-created`):** Disparo em < 3 segundos após criação do pedido/pagamento com envio correto do Código de Confirmação de 4 dígitos.
  - [ ] **Workflow 2 (`order-dispatch`):** Disparo acionado na transição de status para `em_rota` com informações do motoboy.
  - [ ] **Workflow 3 (`order-delivered`):** Disparo final no status `entregue` com mensagem de agradecimento e link do Instagram (`@teles.adegadelivery`).
  - [ ] Tratamento de números de telefone sem DDD (adicionando código de país `55` e DDD `13` se ausente).
  - [ ] Sistema de retry (3 tentativas) e registro de erros na tabela `logs_integracao` do Supabase.

- [ ] **Documentação & Validação:**
  - [ ] Todos os exemplos de código validados no TypeScript 5+ strict mode.
  - [ ] Diagramas de fluxo Mermaid testados e renderizando corretamente.
