'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, MapPin, Loader2, ShoppingBag } from 'lucide-react';
import { ConfirmationCodeCard } from '@/components/order/ConfirmationCodeCard';
import { OrderStatusStepper } from '@/components/order/OrderStatusStepper';
import { useOrderRealtime, OrderRealtimeData } from '@/hooks/useOrderRealtime';
import { supabase } from '@/services/supabaseClient';
import { PedidoItem } from '@/types/storefront';

export default function PedidoPage() {
  const params = useParams();
  const pedidoId = params.id as string;

  const [initialData, setInitialData] = useState<OrderRealtimeData | null>(null);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPedidoDetails() {
      if (!pedidoId) return;

      try {
        setLoading(true);

        const { data: pedidoData, error: pedidoError } = await supabase
          .from('pedidos')
          .select('*')
          .eq('id', pedidoId)
          .single();

        if (pedidoError) throw pedidoError;
        setInitialData(pedidoData as OrderRealtimeData);

        const { data: itensData, error: itensError } = await supabase
          .from('itens_pedido')
          .select('*')
          .eq('pedido_id', pedidoId);

        if (!itensError && itensData) {
          setItens(itensData as PedidoItem[]);
        }
      } catch (err: unknown) {
        console.error('Erro ao carregar pedido:', err);
        setError('Pedido não encontrado ou indisponível no momento.');
      } finally {
        setLoading(false);
      }
    }

    fetchPedidoDetails();
  }, [pedidoId]);

  const { pedido } = useOrderRealtime(pedidoId, initialData);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold mb-2 text-red-400">Ops! Pedido Não Encontrado</h1>
        <p className="text-sm text-zinc-400 max-w-sm mb-6">
          Não encontramos o pedido solicitado. Verifique o link ou entre em contato com a adega.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-bold text-sm rounded-xl transition"
        >
          Voltar para a Vitrine
        </Link>
      </div>
    );
  }

  const whatsappMessage = encodeURIComponent(
    `Olá Teles Adega! Quero informações sobre o meu pedido #${pedido.id.slice(0, 8)}`
  );

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a Vitrine
          </Link>
          <span className="text-xs text-zinc-400 font-mono">
            Pedido #{pedido.id.slice(0, 8)}
          </span>
        </div>

        {/* Highlight 4-digit confirmation code */}
        <ConfirmationCodeCard codigoEntrega={pedido.codigo_entrega} />

        {/* Realtime Stepper */}
        <OrderStatusStepper status={pedido.status} formaPagamento={pedido.forma_pagamento} />

        {/* Order Details & Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Address Card */}
          <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-sm">
              <MapPin className="w-4 h-4" />
              Endereço de Entrega
            </div>
            <div className="text-xs text-zinc-300 space-y-1">
              <p className="font-semibold text-white">{pedido.cliente_nome}</p>
              <p>
                {pedido.endereco_rua}, Nº {pedido.endereco_numero}
              </p>
              <p>Bairro: {pedido.endereco_bairro}</p>
              {pedido.endereco_complemento && (
                <p className="text-zinc-400">Comp: {pedido.endereco_complemento}</p>
              )}
              {pedido.ponto_referencia && (
                <p className="text-zinc-400">Ref: {pedido.ponto_referencia}</p>
              )}
              <p className="text-zinc-400">WhatsApp: {pedido.cliente_whatsapp}</p>
            </div>
          </div>

          {/* Items Summary Card */}
          <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-sm">
              <ShoppingBag className="w-4 h-4" />
              Resumo dos Itens
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 text-xs">
              {itens.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-zinc-300">
                  <span>
                    <span className="font-bold text-[#F59E0B]">{item.quantidade}x</span>{' '}
                    {item.produto_nome || 'Produto'}
                  </span>
                  <span className="font-semibold text-white">
                    R$ {Number(item.subtotal).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#262626] pt-3 text-xs space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Taxa de Entrega:</span>
                <span>R$ {Number(pedido.taxa_entrega).toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1">
                <span>Total:</span>
                <span className="text-[#F59E0B]">
                  R$ {Number(pedido.valor_total).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Support CTA */}
        <a
          href={`https://wa.me/5513997650605?text=${whatsappMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 bg-[#22C55E] hover:bg-[#16a34a] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#22C55E]/10 transition"
        >
          <MessageCircle className="w-5 h-5" />
          Falar com a Adega no WhatsApp (13) 99765-0605
        </a>
      </div>
    </div>
  );
}
