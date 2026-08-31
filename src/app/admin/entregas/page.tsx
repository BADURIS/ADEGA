'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bike, DollarSign, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { CodeValidationInput } from '@/components/admin/entregas/CodeValidationInput';
import { Motoboy } from '@/types/motoboy';
import { Pedido } from '@/types/storefront';

export default function AdminEntregasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Busca motoboys ativos
      const { data: motoboysData } = await supabase
        .from('motoboys')
        .select('*')
        .eq('ativo', true);

      if (motoboysData) setMotoboys(motoboysData);

      // Busca pedidos em preparo ou em rota
      const { data: pedidosData, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          motoboy:motoboys(nome, telefone)
        `)
        .in('status', ['em_preparo', 'em_rota'])
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setPedidos((pedidosData as Pedido[]) || []);
    } catch (err: unknown) {
      console.error('Erro ao carregar entregas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAtribuirMotoboy = async (pedidoId: string, motoboyId: string) => {
    if (!motoboyId) return;

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'em_rota',
          motoboy_id: motoboyId,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pedidoId);

      if (error) throw error;
      fetchData();
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao atribuir motoboy';
      alert(`Erro ao atribuir motoboy: ${errMessage}`);
    }
  };

  const handleFinalizarEntrega = async (pedidoId: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'entregue',
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pedidoId);

      if (error) throw error;
      fetchData();
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao finalizar entrega';
      alert(`Erro ao finalizar entrega: ${errMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
        <p className="text-xs text-zinc-400 font-medium">Carregando painel de entregas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action to Caixa */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#262626] pb-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Bike className="w-6 h-6 text-[#F59E0B]" />
            Módulo de Entregas & Expedição
          </h1>
          <p className="text-xs text-zinc-400">
            Gerencie motoboys, atribua rotas e valide códigos OTP de entrega
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 bg-[#161616] hover:bg-[#222222] border border-[#262626] rounded-xl text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Link
            href="/admin/entregas/caixa"
            className="px-4 py-2.5 bg-[#22C55E] hover:bg-[#16a34a] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#22C55E]/10 flex items-center gap-2 transition"
          >
            <DollarSign className="w-4 h-4" />
            Fechamento de Caixa Diário
          </Link>
        </div>
      </div>

      {/* List of Orders in Expedition */}
      {pedidos.length === 0 ? (
        <div className="p-12 text-center bg-[#161616] border border-[#262626] rounded-2xl text-zinc-400 text-sm">
          <Bike className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
          Nenhum pedido aguardando despacho ou em rota de entrega no momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-xl"
            >
              {/* Top info */}
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <span className="text-sm font-mono font-bold text-white">#{pedido.id.slice(0, 6)}</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    pedido.status === 'em_rota'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {pedido.status === 'em_rota' ? '🛵 Em Rota' : '📦 Em Preparo'}
                </span>
              </div>

              {/* Customer details */}
              <div className="text-xs space-y-1">
                <p className="font-bold text-white text-sm">{pedido.cliente_nome}</p>
                <p className="text-zinc-300">
                  {pedido.endereco_rua}, Nº {pedido.endereco_numero} -{' '}
                  <strong className="text-white">{pedido.endereco_bairro}</strong>
                </p>
                <p className="text-zinc-400">WhatsApp: {pedido.cliente_whatsapp}</p>
                <p className="text-[#F59E0B] font-semibold pt-1">
                  Pagamento: {pedido.forma_pagamento.toUpperCase()} | Total: R${' '}
                  {Number(pedido.valor_total).toFixed(2).replace('.', ',')}
                </p>
              </div>

              {/* Motoboy Assignment */}
              <div className="space-y-1.5 pt-2 border-t border-[#262626]">
                <label className="block text-[11px] font-semibold text-zinc-400">
                  Entregador Responsável:
                </label>
                <select
                  value={pedido.motoboy_id || ''}
                  onChange={(e) => handleAtribuirMotoboy(pedido.id, e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2 rounded-xl text-xs outline-none transition"
                >
                  <option value="">-- Selecione o Motoboy --</option>
                  {motoboys.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.telefone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Botão de Acesso Direto à Rota do Motoboy */}
              <Link
                href={`/motoboy/entrega/${pedido.id}`}
                target="_blank"
                className="w-full py-2.5 bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/30 text-[#8B5CF6] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Bike className="w-4 h-4" />
                Abrir Rota do Entregador (GPS)
              </Link>

              {/* OTP Validation Input if Order is in Route */}
              {pedido.status === 'em_rota' && (
                <CodeValidationInput
                  pedidoId={pedido.id}
                  codigoEsperado={pedido.codigo_entrega}
                  onSuccess={() => handleFinalizarEntrega(pedido.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
