'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, Loader2, ShieldAlert, Wine } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';

const loginSchema = z.object({
  email: z.string().email('E-mail em formato inválido'),
  password: z.string().min(6, 'A senha deve conter no mínimo 6 caracteres'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('erro') === 'sem_permissao') {
        setErrorMessage('Sua conta não tem permissão de administrador. Contate o responsável pelo sistema.');
      }
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });


  const onSubmit = async (values: LoginValues) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Checagem de Rate Limiting para evitar força bruta
      const rlRes = await fetch('/api/ratelimit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', key: values.email }),
      });

      const rlData = await rlRes.json().catch(() => ({ allowed: true }));
      if (!rlRes.ok || rlData.allowed === false) {
        setErrorMessage(rlData.error || 'Muitas tentativas de login. Por favor, aguarde alguns minutos.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        window.location.href = '/admin/dashboard';
      }

    } catch (err: unknown) {
      console.error('Erro de login:', err);
      const errMessage = err instanceof Error ? err.message : 'Credenciais inválidas ou acesso não autorizado. Verifique e-mail e senha.';
      setErrorMessage(errMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161616] border border-[#262626] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl flex items-center justify-center text-[#F59E0B] mx-auto mb-2">
            <Wine className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">TELES ADEGA</h1>
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
            Painel Administrativo & Operacional
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-zinc-300 mb-1.5">
              E-mail do Administrador
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 absolute left-3.5 text-zinc-500" />
              <input
                id="admin-email"
                type="email"
                autoComplete="username email"
                placeholder="admin@adegateles.com.br"
                {...register('email')}
                className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition"
              />
            </div>
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-zinc-300 mb-1.5">Senha de Acesso</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 text-zinc-500" />
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition"
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-extrabold text-sm rounded-xl shadow-lg shadow-[#F59E0B]/10 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Autenticando...
              </>
            ) : (
              'Entrar no Painel'
            )}
          </button>
        </form>

        <div className="border-t border-[#262626] pt-4 text-center">
          <p className="text-[11px] text-zinc-500">
            Acesso restrito à equipe interna do Teles Adega Delivery.
          </p>
        </div>
      </div>
    </div>
  );
}
