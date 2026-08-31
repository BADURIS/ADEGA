'use client';

import React, { useState } from 'react';
import { CreditCard, Banknote, ShieldAlert, CheckCircle2, QrCode, Search, Loader2 } from 'lucide-react';
import { FormaPagamento } from '@/types/storefront';
import { supabase } from '@/services/supabaseClient';
import { ClienteFiadoInfo } from '@/types/checkout';

interface PaymentSelectorProps {
  formaPagamento: FormaPagamento;
  onSelectFormaPagamento: (forma: FormaPagamento) => void;
  valorTotal: number;
  trocoPara: number | undefined;
  onTrocoChange: (valor: number | undefined) => void;
  onFiadoVerified: (clienteInfo: ClienteFiadoInfo | null) => void;
}

export function PaymentSelector({
  formaPagamento,
  onSelectFormaPagamento,
  valorTotal,
  trocoPara,
  onTrocoChange,
  onFiadoVerified,
}: PaymentSelectorProps) {
  const [whatsappFiado, setWhatsappFiado] = useState('');
  const [verificandoFiado, setVerificandoFiado] = useState(false);
  const [fiadoInfo, setFiadoInfo] = useState<ClienteFiadoInfo | null>(null);
  const [erroFiado, setErroFiado] = useState<string | null>(null);

  const handleVerificarFiado = async () => {
    const cleanedWhatsapp = whatsappFiado.replace(/\D/g, '');
    if (!cleanedWhatsapp || cleanedWhatsapp.length < 10) {
      setErroFiado('Informe um número de WhatsApp válido com DDD.');
      setFiadoInfo(null);
      onFiadoVerified(null);
      return;
    }

    setVerificandoFiado(true);
    setErroFiado(null);

    try {
      // Checagem de Rate Limiting para consultas de fiado
      const rlRes = await fetch('/api/ratelimit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fiado', key: cleanedWhatsapp }),
      });

      const rlData = await rlRes.json().catch(() => ({ allowed: true }));
      if (!rlRes.ok || rlData.allowed === false) {
        setErroFiado(rlData.error || 'Muitas consultas realizadas. Aguarde alguns minutos.');
        setVerificandoFiado(false);
        return;
      }

      // Consulta sanitizada via RPC SECURITY DEFINER
      const { data: resData, error } = await supabase.rpc('consultar_fiado', {
        p_whatsapp: cleanedWhatsapp,
      });


      if (error) throw error;

      if (!resData || !resData.cliente_id) {
        setErroFiado(resData?.motivo_recusa || 'Cadastro Fiado não encontrado. Fale com a adega via WhatsApp para abrir seu crédito.');
        setFiadoInfo(null);
        onFiadoVerified(null);
        return;
      }

      const saldoDisponivel = Number(resData.saldo_disponivel || 0);
      const aprovadoComPedido = resData.aprovado && saldoDisponivel >= valorTotal;

      const info: ClienteFiadoInfo = {
        id: resData.cliente_id,
        cliente_id: resData.cliente_id,
        saldo_disponivel: saldoDisponivel,
        aprovado: aprovadoComPedido,
        motivo_recusa: aprovadoComPedido
          ? undefined
          : resData.motivo_recusa || `Saldo disponível (R$ ${saldoDisponivel.toFixed(2).replace('.', ',')}) é inferior ao valor do pedido (R$ ${valorTotal.toFixed(2).replace('.', ',')}).`,
      };

      setFiadoInfo(info);
      onFiadoVerified(info);

    } catch (err: unknown) {
      console.error('Erro ao consultar cadastro fiado via RPC:', err);
      setErroFiado('Erro ao consultar cadastro. Tente novamente.');
      setFiadoInfo(null);
      onFiadoVerified(null);
    } finally {
      setVerificandoFiado(false);
    }
  };


  const trocoInvalido =
    formaPagamento === 'dinheiro' &&
    trocoPara !== undefined &&
    trocoPara > 0 &&
    trocoPara < valorTotal;

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
      <div className="flex items-center gap-3 border-b border-[#262626] pb-4">
        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">2. Forma de Pagamento</h2>
          <p className="text-xs text-zinc-400">Escolha como deseja pagar a sua entrega</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Opção Pix */}
        <button
          type="button"
          onClick={() => onSelectFormaPagamento('pix')}
          className={`p-4 rounded-xl border flex flex-col items-center text-center transition ${
            formaPagamento === 'pix'
              ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-lg shadow-[#F59E0B]/10'
              : 'bg-[#0D0D0D] border-[#262626] text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E] mb-2">
            <QrCode className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm text-white">Pix Instantâneo</span>
          <span className="text-[11px] text-zinc-400 mt-1">Aprovação imediata</span>
        </button>

        {/* Opção Dinheiro */}
        <button
          type="button"
          onClick={() => onSelectFormaPagamento('dinheiro')}
          className={`p-4 rounded-xl border flex flex-col items-center text-center transition ${
            formaPagamento === 'dinheiro'
              ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-lg shadow-[#F59E0B]/10'
              : 'bg-[#0D0D0D] border-[#262626] text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] mb-2">
            <Banknote className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm text-white">Dinheiro</span>
          <span className="text-[11px] text-zinc-400 mt-1">Troco na entrega</span>
        </button>

        {/* Opção Fiado */}
        <button
          type="button"
          onClick={() => onSelectFormaPagamento('fiado')}
          className={`p-4 rounded-xl border flex flex-col items-center text-center transition ${
            formaPagamento === 'fiado'
              ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-lg shadow-[#F59E0B]/10'
              : 'bg-[#0D0D0D] border-[#262626] text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm text-white">Fiado (Cadastrados)</span>
          <span className="text-[11px] text-zinc-400 mt-1">Até R$ 300,00 de limite</span>
        </button>
      </div>

      {/* Painel do Pix */}
      {formaPagamento === 'pix' && (
        <div className="p-4 bg-[#0D0D0D] border border-[#262626] rounded-xl text-xs space-y-2 text-zinc-300">
          <div className="flex items-center gap-2 text-[#22C55E] font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Pagamento por Chave Pix ou QR Code</span>
          </div>
          <p>
            Após confirmar o pedido, o QR Code Pix e a chave copia-e-cola serão gerados para você efetuar a transferência no aplicativo do seu banco.
          </p>
        </div>
      )}

      {/* Painel de Dinheiro */}
      {formaPagamento === 'dinheiro' && (
        <div className="p-4 bg-[#0D0D0D] border border-[#262626] rounded-xl space-y-3">
          <label className="block text-xs font-semibold text-zinc-300">
            Precisa de troco para quanto? (Opcional - Deixe em branco se for valor exato)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-zinc-500">R$</span>
            <input
              type="number"
              step="0.01"
              placeholder={`Ex: ${(valorTotal + 10).toFixed(2)}`}
              value={trocoPara || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onTrocoChange(isNaN(val) ? undefined : val);
              }}
              className="w-full bg-[#161616] border border-[#262626] focus:border-[#F59E0B] text-white pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition"
            />
          </div>

          {trocoInvalido && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              O valor para troco deve ser maior ou igual ao total do pedido (R${' '}
              {valorTotal.toFixed(2).replace('.', ',')}).
            </p>
          )}
        </div>
      )}

      {/* Painel de Fiado */}
      {formaPagamento === 'fiado' && (
        <div className="p-4 bg-[#0D0D0D] border border-[#262626] rounded-xl space-y-4">
          <div className="text-xs text-zinc-300 space-y-1">
            <p className="font-semibold text-white">Consulta de Cliente Cadastrado (Fiado)</p>
            <p className="text-zinc-400">
              Digite seu número de WhatsApp para verificar seu saldo de crédito aprovado.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="DDD + WhatsApp (Ex: 13997650605)"
              value={whatsappFiado}
              onChange={(e) => setWhatsappFiado(e.target.value)}
              className="flex-1 bg-[#161616] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2 rounded-xl text-sm outline-none transition"
            />
            <button
              type="button"
              onClick={handleVerificarFiado}
              disabled={verificandoFiado}
              className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-bold text-xs rounded-xl flex items-center gap-2 transition disabled:opacity-50"
            >
              {verificandoFiado ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Consultar
            </button>
          </div>

          {erroFiado && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erroFiado}</span>
            </div>
          )}

          {fiadoInfo && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                fiadoInfo.aprovado
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-sm">
                <span>Status do Cadastro</span>
                <span className={fiadoInfo.aprovado ? 'text-[#22C55E]' : 'text-red-400'}>
                  {fiadoInfo.aprovado ? '✓ Crédito Aprovado' : '✕ Bloqueado'}
                </span>
              </div>

              <div className="text-zinc-300 pt-2 border-t border-zinc-800">
                <span className="text-zinc-500 block">Saldo Disponível para Compras:</span>
                <span className="font-bold text-sm text-white">R$ {fiadoInfo.saldo_disponivel.toFixed(2).replace('.', ',')}</span>
              </div>

              {!fiadoInfo.aprovado && (
                <p className="text-red-400 text-[11px] pt-1">{fiadoInfo.motivo_recusa}</p>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
