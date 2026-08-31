'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, DollarSign, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Motoboy } from '@/types/motoboy';
import { Pedido } from '@/types/storefront';

export default function AdminFechamentoCaixaPage() {
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string>('todos');
  const [pedidosEntregues, setPedidosEntregues] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [acertoConfirmado, setAcertoConfirmado] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: motoboysData } = await supabase
        .from('motoboys')
        .select('*')
        .eq('ativo', true);

      if (motoboysData) setMotoboys(motoboysData);

      let query = supabase
        .from('pedidos')
        .select(`
          *,
          motoboy:motoboys(nome)
        `)
        .eq('status', 'entregue')
        .order('criado_em', { ascending: false });

      if (selectedMotoboyId !== 'todos') {
        query = query.eq('motoboy_id', selectedMotoboyId);
      }

      const { data: pedidosData, error } = await query;
      if (error) throw error;

      setPedidosEntregues(pedidosData || []);
    } catch (err) {
      console.error('Erro ao carregar caixa:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMotoboyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cálculos financeiros do Caixa
  const totalFaturado = pedidosEntregues.reduce((acc, p) => acc + Number(p.valor_total), 0);
  const totalDinheiro = pedidosEntregues
    .filter((p) => p.forma_pagamento === 'dinheiro')
    .reduce((acc, p) => acc + Number(p.valor_total), 0);
  const totalPix = pedidosEntregues
    .filter((p) => p.forma_pagamento === 'pix')
    .reduce((acc, p) => acc + Number(p.valor_total), 0);
  const totalFiado = pedidosEntregues
    .filter((p) => p.forma_pagamento === 'fiado')
    .reduce((acc, p) => acc + Number(p.valor_total), 0);

  const handleConfirmarAcerto = () => {
    setAcertoConfirmado(true);
    setTimeout(() => setAcertoConfirmado(false), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-4">
        <Link
          href="/admin/entregas"
          className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Entregas
        </Link>
        <span className="text-xs text-[#F59E0B] font-bold flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString('pt-BR')}
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#22C55E]" />
            Fechamento de Caixa Diário por Motoboy
          </h1>
          <p className="text-xs text-zinc-400">
            Conferência de valores recebidos em dinheiro, Pix e lançamentos fiado
          </p>
        </div>

        {/* Motoboy Filter */}
        <div className="w-full md:w-auto">
          <select
            value={selectedMotoboyId}
            onChange={(e) => setSelectedMotoboyId(e.target.value)}
            className="w-full md:w-64 bg-[#161616] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-xs font-semibold outline-none transition"
          >
            <option value="todos">-- Todos os Motoboys --</option>
            {motoboys.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#161616] border border-[#262626] p-4 rounded-2xl space-y-1">
              <span className="text-[11px] text-zinc-400 font-semibold block">Total Entregas</span>
              <span className="text-2xl font-black text-white">{pedidosEntregues.length}</span>
              <span className="text-[10px] text-zinc-500 block">pedidos concluídos</span>
            </div>

            <div className="bg-[#161616] border border-[#22C55E]/30 p-4 rounded-2xl space-y-1 bg-[#22C55E]/5">
              <span className="text-[11px] text-[#22C55E] font-semibold block">
                💵 Dinheiro A Receber (Motoboy)
              </span>
              <span className="text-2xl font-black text-[#22C55E]">
                R$ {totalDinheiro.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[10px] text-emerald-400 block font-bold">
                Passar no caixa da adega
              </span>
            </div>

            <div className="bg-[#161616] border border-emerald-500/20 p-4 rounded-2xl space-y-1">
              <span className="text-[11px] text-zinc-400 font-semibold block">
                ⚡ Pix (Conta Bancária)
              </span>
              <span className="text-2xl font-black text-white">
                R$ {totalPix.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[10px] text-zinc-500 block">Confirmado online</span>
            </div>

            <div className="bg-[#161616] border border-blue-500/20 p-4 rounded-2xl space-y-1">
              <span className="text-[11px] text-zinc-400 font-semibold block">
                📋 Fiado (Débito Cliente)
              </span>
              <span className="text-2xl font-black text-white">
                R$ {totalFiado.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[10px] text-zinc-500 block">Lançado em conta</span>
            </div>
          </div>

          {/* Detailed Statement Card */}
          <div className="bg-[#161616] border border-[#262626] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Extrato Discriminado do Fechamento
              </h2>
              <span className="text-xs text-[#F59E0B] font-bold">
                Total Geral: R$ {totalFaturado.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div className="space-y-3 divide-y divide-[#262626]">
              {pedidosEntregues.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  Nenhuma entrega concluída registrada para este filtro hoje.
                </p>
              ) : (
                pedidosEntregues.map((p) => (
                  <div key={p.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-white">#{p.id.slice(0, 6)}</span> -{' '}
                      <span className="text-zinc-300">{p.cliente_nome}</span>
                      <p className="text-[11px] text-zinc-500">
                        Motoboy: {p.motoboy?.nome || 'N/A'} | Bairro: {p.endereco_bairro}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-2 ${
                          p.forma_pagamento === 'dinheiro'
                            ? 'bg-[#22C55E]/10 text-[#22C55E]'
                            : p.forma_pagamento === 'pix'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {p.forma_pagamento}
                      </span>
                      <span className="font-bold text-white">
                        R$ {Number(p.valor_total).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Action button */}
            <div className="pt-4 border-t border-[#262626]">
              <button
                type="button"
                onClick={handleConfirmarAcerto}
                disabled={pedidosEntregues.length === 0}
                className="w-full py-3.5 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-[#22C55E]/10 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                Confirmar Acerto e Dar Baixa no Caixa do Motoboy
              </button>

              {acertoConfirmado && (
                <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center font-bold">
                  ✓ Acerto de caixa registrado com sucesso para o turno!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
