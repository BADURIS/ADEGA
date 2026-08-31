'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Lock } from 'lucide-react';

interface CodeValidationInputProps {
  pedidoId?: string;
  codigoEsperado: string;
  onSuccess: () => void;
}

export function CodeValidationInput({
  codigoEsperado,
  onSuccess,
}: CodeValidationInputProps) {
  const [codigo, setCodigo] = useState('');
  const [tentativasRestantes, setTentativasRestantes] = useState(3);
  const [bloqueado, setBloqueado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bloqueado || loading) return;

    const cleaned = codigo.trim();

    if (cleaned.length !== 4) {
      setMensagemErro('O código deve conter exatamente 4 dígitos.');
      return;
    }

    setLoading(true);
    setMensagemErro(null);

    // Simulação ou RPC match
    if (cleaned === codigoEsperado) {
      setLoading(false);
      onSuccess();
    } else {
      setLoading(false);
      const novasTentativas = tentativasRestantes - 1;
      setTentativasRestantes(novasTentativas);

      if (novasTentativas <= 0) {
        setBloqueado(true);
        setMensagemErro(
          '⛔ Limite de 3 tentativas excedido! Validação bloqueada por suspeita de divergência. Contate o cliente via WhatsApp.'
        );
      } else {
        setMensagemErro(
          `Código incorreto! Você tem mais ${novasTentativas} tentativa(s) antes do bloqueio de segurança.`
        );
      }
    }
  };

  return (
    <div className="bg-[#0D0D0D] border border-[#262626] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
          <span>Validação OTP de Entrega (4 Dígitos)</span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            bloqueado
              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
              : 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30'
          }`}
        >
          {bloqueado ? 'BLOQUEADO' : `${tentativasRestantes} tentativa(s)`}
        </span>
      </div>

      {bloqueado ? (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{mensagemErro}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={4}
              placeholder="0000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              className="flex-1 bg-[#161616] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2 rounded-xl text-center font-mono font-extrabold text-lg tracking-widest outline-none transition"
            />
            <button
              type="submit"
              disabled={loading || codigo.length !== 4}
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-purple-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </button>
          </div>

          {mensagemErro && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{mensagemErro}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
