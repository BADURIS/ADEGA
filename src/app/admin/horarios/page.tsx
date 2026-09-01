'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Save, Loader2, CheckCircle2, ShieldAlert, Sparkles, Sun, Moon } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { checkStoreOpeningStatus, StoreStatusResult } from '@/lib/storeStatus';

export default function AdminHorariosPage() {
  const [horarioAbertura, setHorarioAbertura] = useState('18:00');
  const [horarioFechamento, setHorarioFechamento] = useState('02:00');
  const [statusManual, setStatusManual] = useState<'auto' | 'forcado_aberto' | 'forcado_fechado'>('auto');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Status calculado em tempo real para pré-visualização
  const statusCalculado: StoreStatusResult = checkStoreOpeningStatus(
    horarioAbertura,
    horarioFechamento,
    statusManual
  );

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('configuracoes_adega')
          .select('chave, valor');

        if (error) throw error;

        if (data && data.length > 0) {
          const map: Record<string, string> = {};
          data.forEach((item) => {
            map[item.chave] = item.valor;
          });

          if (map['horario_abertura']) setHorarioAbertura(map['horario_abertura']);
          if (map['horario_fechamento']) setHorarioFechamento(map['horario_fechamento']);
          if (map['status_manual']) setStatusManual(map['status_manual'] as any);
        }
      } catch (err) {
        console.error('Erro ao carregar configurações de horário:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMensagemSucesso(null);

    try {
      const payload = [
        { chave: 'horario_abertura', valor: horarioAbertura },
        { chave: 'horario_fechamento', valor: horarioFechamento },
        { chave: 'status_manual', valor: statusManual },
      ];

      const { error } = await supabase
        .from('configuracoes_adega')
        .upsert(payload, { onConflict: 'chave' });

      if (error) throw error;

      setMensagemSucesso('✓ Configurações de horário salvas com sucesso! O site do cliente já foi atualizado.');
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao salvar';
      alert(`Erro ao salvar horários: ${errMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="border-b border-[#262626] pb-4">
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#F59E0B]" />
          Horário de Funcionamento & Status da Adega
        </h1>
        <p className="text-xs text-zinc-400">
          Configure os horários oficiais da loja e o status dinâmico exibido no site do cliente
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card de Configuração */}
          <form onSubmit={handleSave} className="bg-[#161616] border border-[#262626] rounded-2xl p-6 space-y-5 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#262626] pb-3">
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
              Configurações de Horário
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Horário de Abertura
                </label>
                <input
                  type="time"
                  value={horarioAbertura}
                  onChange={(e) => setHorarioAbertura(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm font-mono font-bold outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  Horário de Fechamento (Suporta Meia-Noite)
                </label>
                <input
                  type="time"
                  value={horarioFechamento}
                  onChange={(e) => setHorarioFechamento(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm font-mono font-bold outline-none transition"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Exemplo: 18:00 às 02:00 &rarr; O sistema mantém a loja aberta até às 02:00 da madrugada seguinte.
                </p>

              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Modo de Funcionamento Manual / Sobrescrita
                </label>
                <select
                  value={statusManual}
                  onChange={(e) => setStatusManual(e.target.value as any)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-xs font-bold outline-none transition"
                >
                  <option value="auto">Automático (Seguir o Relógio de Abertura/Fechamento)</option>
                  <option value="forcado_aberto">🟢 Forçar ABERTO (Loja sempre aberta)</option>
                  <option value="forcado_fechado">🔴 Forçar ENCERRADA (Loja em pausa / fechada)</option>
                </select>
              </div>
            </div>

            {mensagemSucesso && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{mensagemSucesso}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-bold text-xs rounded-xl shadow-lg shadow-[#F59E0B]/10 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Horários da Adega
            </button>
          </form>

          {/* Card de Pré-visualização em Tempo Real */}
          <div className="bg-[#161616] border border-[#262626] rounded-2xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-white border-b border-[#262626] pb-3 mb-4">
                Status no Site do Cliente
              </h2>

              <div className="p-5 bg-[#0D0D0D] border border-[#262626] rounded-2xl space-y-4">
                <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                  Pré-visualização do Header
                </span>

                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-extrabold ${statusCalculado.badgeCor}`}>
                  <span>{statusCalculado.statusTexto}</span>
                  <span>•</span>
                  <span>{statusCalculado.horarioTexto}</span>
                </div>

                <div className="text-xs text-zinc-400 leading-relaxed border-t border-[#262626] pt-3">
                  {statusCalculado.aberto ? (
                    <p className="text-emerald-400 font-semibold">
                      ✓ A loja está aceitando pedidos normalmente neste horário.
                    </p>
                  ) : (
                    <p className="text-rose-400 font-semibold">
                      ✕ A loja está marcada como encerrada. O site informa que retornará às {horarioAbertura}.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#0D0D0D] border border-[#262626] rounded-xl text-xs space-y-2 text-zinc-400">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Regra de Atendimento Noturno</span>
              </div>
              <p>
                A Teles Adega opera principalmente em horário noturno. Ao configurar das <strong>{horarioAbertura}</strong> às <strong>{horarioFechamento}</strong>, o sistema gerencia automaticamente a mudança de dia à meia-noite sem interromper as compras dos clientes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
