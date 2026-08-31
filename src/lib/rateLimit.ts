interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const ACTION_CONFIGS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowSeconds: 15 * 60 }, // 5 tentativas a cada 15 min
  checkout: { maxRequests: 5, windowSeconds: 10 * 60 }, // 5 pedidos a cada 10 min
  fiado: { maxRequests: 10, windowSeconds: 5 * 60 }, // 10 consultas a cada 5 min
};

// Map em memória para fallback (sliding window)
interface MemoryRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryRecord>();

/**
 * Avalia se uma determinada ação excedeu o limite de requisições por identificador (IP ou chave de usuário).
 * Tenta utilizar a API HTTP do Upstash Redis se configurado; caso contrário, utiliza fallback em memória.
 */
export async function evaluateRateLimit(
  action: 'login' | 'checkout' | 'fiado',
  identifier: string
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
  const config = ACTION_CONFIGS[action] || { maxRequests: 5, windowSeconds: 600 };
  const key = `ratelimit:${action}:${identifier}`;
  const now = Date.now();

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // 1. Tentar Upstash Redis HTTP API se configurado
  if (upstashUrl && upstashToken) {
    try {
      const pipelineRes = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, config.windowSeconds, 'NX'],
          ['TTL', key],
        ]),
      });

      if (pipelineRes.ok) {
        const results = await pipelineRes.json();
        const count = Number(results[0]?.result || 1);
        const ttl = Number(results[2]?.result || config.windowSeconds);

        const allowed = count <= config.maxRequests;
        const remaining = Math.max(0, config.maxRequests - count);

        return {
          allowed,
          remaining,
          resetInSeconds: ttl > 0 ? ttl : config.windowSeconds,
        };
      }
    } catch (err) {
      console.warn('[RateLimit] Falha ao consultar Upstash Redis, utilizando fallback em memória:', err);
    }
  }

  // 2. Fallback em memória local
  const currentRecord = memoryStore.get(key);

  if (!currentRecord || now > currentRecord.resetAt) {
    const newResetAt = now + config.windowSeconds * 1000;
    memoryStore.set(key, { count: 1, resetAt: newResetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetInSeconds: config.windowSeconds,
    };
  }

  currentRecord.count += 1;
  const resetInSeconds = Math.ceil((currentRecord.resetAt - now) / 1000);
  const allowed = currentRecord.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - currentRecord.count);

  return {
    allowed,
    remaining,
    resetInSeconds,
  };
}
