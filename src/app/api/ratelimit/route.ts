import { NextRequest, NextResponse } from 'next/server';
import { evaluateRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, key } = body;

    if (action !== 'login' && action !== 'checkout' && action !== 'fiado') {
      return NextResponse.json({ error: 'Ação de Rate Limit inválida' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const identifier = key ? `${ip}:${key}` : ip;

    const result = await evaluateRateLimit(action, identifier);

    if (!result.allowed) {
      const minutos = Math.ceil(result.resetInSeconds / 60);
      return NextResponse.json(
        {
          allowed: false,
          error: `Muitas tentativas registradas. Por favor, aguarde ${minutos} minuto(s) para tentar novamente.`,
          resetInSeconds: result.resetInSeconds,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        allowed: true,
        remaining: result.remaining,
        resetInSeconds: result.resetInSeconds,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('[RateLimit API] Erro ao processar verificação (falhando fechado):', err);
    return NextResponse.json(
      {
        allowed: false,
        error: 'Erro de verificação de limite. Por favor, aguarde alguns instantes e tente novamente.',
        resetInSeconds: 60,
      },
      { status: 429 }
    );
  }
}

