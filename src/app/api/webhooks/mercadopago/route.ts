import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sanitizeForLog } from '@/lib/logUtils';

export const dynamic = 'force-dynamic';

function verificarAssinaturaMercadoPago(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null
): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Webhook MercadoPago] AVISO: MERCADO_PAGO_WEBHOOK_SECRET não configurado. Pulando validação de assinatura em DEV.');
      return true;
    }
    return false;
  }
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = xSignature.split(',');
  let ts = '';
  let hashV1 = '';

  for (const part of parts) {
    const [key, val] = part.split('=');
    if (key.trim() === 'ts') ts = val.trim();
    if (key.trim() === 'v1') hashV1 = val.trim();
  }

  if (!ts || !hashV1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  return hmac === hashV1;
}

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // Falhar fechado em produção se segredos de autenticação não estiverem configurados
    if (isProd && (!webhookSecret || !accessToken)) {
      console.error('[Webhook MercadoPago] ERRO DE CONFIGURAÇÃO: MERCADO_PAGO_WEBHOOK_SECRET ou MERCADO_PAGO_ACCESS_TOKEN não definidos em ambiente de produção.');
      return NextResponse.json(
        { error: 'Webhook environment security configuration missing' },
        { status: 500 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    const body = await req.json().catch(() => ({}));
    const paymentId = body?.data?.id || req.nextUrl.searchParams.get('data.id');
    const action = body?.action || body?.type;

    console.log(`[Webhook MercadoPago] Recebido - Action: ${action}, PaymentID: ${paymentId}`);

    // Exigência estrita de verificação de assinatura
    if (!verificarAssinaturaMercadoPago(xSignature, xRequestId, String(paymentId))) {
      console.warn('[Webhook MercadoPago] Assinatura x-signature inválida ou ausente.');
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 });
    }

    if (action !== 'payment.created' && action !== 'payment.updated' && action !== 'payment') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
    }

    // Consulta obrigatória na API do Mercado Pago (GET /v1/payments/{id})
    if (!accessToken) {
      console.error('[Webhook MercadoPago] MERCADO_PAGO_ACCESS_TOKEN não configurado.');
      return NextResponse.json({ error: 'Mercado Pago access token not configured' }, { status: 500 });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mpRes.ok) {
      console.error(`[Webhook MercadoPago] Erro ao consultar pagamento ID ${paymentId} na API do MP (${mpRes.status}).`);
      return NextResponse.json({ error: 'Failed to fetch payment status from MP' }, { status: 502 });
    }

    const paymentDetails = await mpRes.json();
    const mpStatus = paymentDetails.status;
    const pedidoId = paymentDetails.external_reference || paymentId;
    const mpTransactionAmount = Number(paymentDetails.transaction_amount || 0);

    if (mpStatus === 'approved') {
      const { data: pedido, error: fetchErr } = await supabaseAdmin
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

      if (fetchErr || !pedido) {
        console.error(`[Webhook MercadoPago] Pedido ${pedidoId} não encontrado no Supabase.`);
        return NextResponse.json({ error: 'Pedido not found' }, { status: 404 });
      }

      // Validação de divergência do valor total do pedido vs valor pago no Mercado Pago
      const pedidoValorTotal = Number(pedido.valor_total || 0);
      if (Math.abs(mpTransactionAmount - pedidoValorTotal) > 0.05) {
        console.error(
          `[Webhook MercadoPago] FRAUDE/DIVERGÊNCIA: Valor transacionado no MP (R$ ${mpTransactionAmount}) diverge do valor do pedido ${pedidoId} (R$ ${pedidoValorTotal}).`
        );
        return NextResponse.json(
          { error: 'Payment transaction amount mismatch' },
          { status: 400 }
        );
      }

      const { error: updateErr } = await supabaseAdmin
        .from('pedidos')
        .update({
          status: 'em_preparo',
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pedidoId);

      if (updateErr) {
        console.error(`[Webhook MercadoPago] Erro ao atualizar pedido ${pedidoId}:`, sanitizeForLog(updateErr));
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      // Notificação ao n8n
      if (process.env.N8N_BASE_URL) {
        try {
          await fetch(`${process.env.N8N_BASE_URL}/webhook/order-created`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              sanitizeForLog({
                event: 'order_payment_approved',
                pedido: {
                  id: pedido.id,
                  cliente_nome: pedido.cliente_nome,
                  cliente_whatsapp: pedido.cliente_whatsapp,
                  valor_total: pedido.valor_total,
                  codigo_entrega: pedido.codigo_entrega,
                  status: 'em_preparo',
                },
              })
            ),
          });
        } catch (n8nErr) {
          console.error('[Webhook MercadoPago] Erro ao notificar n8n:', sanitizeForLog(n8nErr));
        }
      }
    }

    return NextResponse.json({ success: true, paymentId, mpStatus }, { status: 200 });
  } catch (error: unknown) {
    console.error('[Webhook MercadoPago] Exceção não tratada:', sanitizeForLog(error));
    const errMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

