import { createClient } from '@supabase/supabase-js';

/**
 * Cliente admin do Supabase com privilégios de service_role para operações de servidor e webhooks.
 * Lança exceção explícita se as credenciais de serviço não estiverem configuradas no ambiente.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const errorMessage =
      '[SupabaseAdmin] ERRO CRÍTICO: Configuração inválida de ambiente. SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL não está definida. Operação abortada por segurança.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
