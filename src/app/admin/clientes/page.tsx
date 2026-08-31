'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Users, Search, DollarSign, Loader2, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';

export interface Cliente {
  id: string;
  nome: string;
  whatsapp: string;
  bairro?: string;
  endereco_completo?: string;
  limite_fiado: number;
  saldo_fiado_atual: number;
  ativo?: boolean;
}

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal para dar baixa em Fiado
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [valorBaixa, setValorBaixa] = useState<string>('');
  const [processandoBaixa, setProcessandoBaixa] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes((data as Cliente[]) || []);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDarBaixaFiado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente) return;

    const valor = parseFloat(valorBaixa);
    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    setProcessandoBaixa(true);
    setMensagemSucesso(null);

    try {
      const novoSaldo = Math.max(0, Number(selectedCliente.saldo_fiado_atual) - valor);

      const { error } = await supabase
        .from('clientes')
        .update({
          saldo_fiado_atual: novoSaldo,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', selectedCliente.id);

      if (error) throw error;

      setMensagemSucesso(`✓ Baixa de R$ ${valor.toFixed(2)} efetuada com sucesso! Novo saldo: R$ ${novoSaldo.toFixed(2)}`);
      fetchData();
      setTimeout(() => {
        setSelectedCliente(null);
        setValorBaixa('');
        setMensagemSucesso(null);
      }, 2000);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao dar baixa';
      alert(`Erro ao dar baixa no fiado: ${errMessage}`);
    } finally {
      setProcessandoBaixa(false);
    }
  };

  const filteredClientes = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.whatsapp.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#262626] pb-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#F59E0B]" />
            Gestão de Clientes & Conta Fiado
          </h1>
          <p className="text-xs text-zinc-400">
            Acompanhamento de histórico de vendas, saldo devedor e recebimentos
          </p>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por Nome ou WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#161616] border border-[#262626] focus:border-[#F59E0B] text-white pl-9 pr-4 py-2 rounded-xl text-xs outline-none transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin mx-auto" />
        </div>
      ) : (
        <div className="bg-[#161616] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#0D0D0D] border-b border-[#262626] text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">WhatsApp</th>
                  <th className="py-3.5 px-4">Bairro / Endereço</th>
                  <th className="py-3.5 px-4">Limite Fiado</th>
                  <th className="py-3.5 px-4">Saldo Devedor</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredClientes.map((c) => {
                  const possuiDebito = Number(c.saldo_fiado_atual) > 0;

                  return (
                    <tr key={c.id} className="hover:bg-[#222222]/50 transition">
                      <td className="py-3 px-4 font-bold text-white">{c.nome}</td>
                      <td className="py-3 px-4 font-mono text-zinc-300">{c.whatsapp}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {c.bairro} ({c.endereco_completo})
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-300">
                        R$ {Number(c.limite_fiado).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            possuiDebito
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'text-zinc-500'
                          }`}
                        >
                          R$ {Number(c.saldo_fiado_atual).toFixed(2).replace('.', ',')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {possuiDebito && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCliente(c);
                              setValorBaixa(Number(c.saldo_fiado_atual).toFixed(2));
                            }}
                            className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#16a34a] text-white font-bold text-[11px] rounded-lg transition shadow flex items-center gap-1 ml-auto"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Dar Baixa em Fiado
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Dar Baixa em Fiado */}
      {selectedCliente && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#262626] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedCliente(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#262626] pb-3">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Abatimento / Baixa de Fiado</h3>
                <p className="text-xs text-zinc-400">Cliente: {selectedCliente.nome}</p>
              </div>
            </div>

            <form onSubmit={handleDarBaixaFiado} className="space-y-4 pt-2">
              <div className="p-3 bg-[#0D0D0D] border border-[#262626] rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Saldo Devedor Atual:</span>
                  <span className="font-bold text-amber-400">
                    R$ {Number(selectedCliente.saldo_fiado_atual).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Valor Pago pelo Cliente (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={valorBaixa}
                  onChange={(e) => setValorBaixa(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm font-bold outline-none transition"
                />
              </div>

              {mensagemSucesso && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold">
                  {mensagemSucesso}
                </div>
              )}

              <button
                type="submit"
                disabled={processandoBaixa}
                className="w-full py-3 bg-[#22C55E] hover:bg-[#16a34a] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#22C55E]/10 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {processandoBaixa ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirmar Recebimento e Atualizar Saldo
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
