// USE ISSO APENAS PARA CONSOLE.LOG/CONSOLE.ERROR. NUNCA aplique em payloads de webhooks/integrações de saída que dependem do dado real (ex.: notificação de WhatsApp via n8n).

/**
 * Utilitários para higienização e conformidade de logs (LGPD).
 * Mascara dados sensíveis de clientes (WhatsApp/E-mail) e remove segredos de observabilidade.
 */

/**
 * Mascara números de telefone/WhatsApp para logs.
 * Exemplo: '5511999999999' -> '5511999***999'
 */
export function maskPhone(phone?: string | null): string {

  if (!phone) return '[SEM TELEFONE]';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 8) return '***';
  return `${clean.slice(0, 7)}***${clean.slice(-3)}`;
}

/**
 * Mascara endereços de e-mail para logs.
 * Exemplo: 'joao.silva@email.com' -> 'j***a@email.com'
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '[EMAIL INVÁLIDO]';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Sanitiza recursivamente qualquer objeto ou payload antes de emitir em console.log / console.error.
 * Oculta senhas, tokens, secrets e mascara dados pessoais de clientes.
 */
export function sanitizeForLog<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLog(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('service_role') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('authorization')
    ) {
      sanitized[key] = '[REDACTED_SECRET]';
    } else if (lowerKey.includes('whatsapp') || lowerKey.includes('telefone') || lowerKey.includes('phone')) {
      sanitized[key] = typeof value === 'string' ? maskPhone(value) : value;
    } else if (lowerKey.includes('email')) {
      sanitized[key] = typeof value === 'string' ? maskEmail(value) : value;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
