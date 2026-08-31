'use client';

import React from 'react';
import { ShoppingBag, Truck } from 'lucide-react';
import { useCartStore, selectCartSubtotal, selectCartTotal } from '@/store/useCartStore';
import { useHydrated } from '@/hooks/useHydrated';

export function OrderSummary() {
  const isHydrated = useHydrated();
  const itens = useCartStore((state) => state.itens);
  const taxaEntrega = useCartStore((state) => state.taxaEntrega);
  const rawSubtotal = useCartStore(selectCartSubtotal);
  const rawTotal = useCartStore(selectCartTotal);

  if (!isHydrated) {
    return (
      <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 md:p-6 shadow-xl animate-pulse h-64">
        <div className="h-6 bg-[#262626] rounded w-1/2 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-[#262626] rounded"></div>
          <div className="h-4 bg-[#262626] rounded"></div>
        </div>
      </div>
    );
  }

  const subtotal = rawSubtotal;
  const total = rawTotal;

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
      <div className="flex items-center gap-3 border-b border-[#262626] pb-4">
        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Resumo do Pedido</h2>
          <p className="text-xs text-zinc-400">{itens.length} item(ns) na sua sacola</p>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-3 pr-1 divide-y divide-[#262626]/50">
        {itens.map((item) => (
          <div key={item.produto.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#F59E0B]">{item.quantidade}x</span>
              <span className="text-zinc-200 font-medium line-clamp-1">{item.produto.nome}</span>
            </div>
            <span className="text-white font-semibold shrink-0 ml-2">
              R$ {item.subtotal.toFixed(2).replace('.', ',')}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-[#262626] pt-4 space-y-2 text-xs">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal dos Produtos</span>
          <span className="text-white font-medium">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
        </div>

        <div className="flex justify-between text-zinc-400 items-center">
          <span className="flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-[#F59E0B]" />
            Taxa de Entrega
          </span>
          <span className="text-white font-medium">
            {taxaEntrega > 0 ? `R$ ${taxaEntrega.toFixed(2).replace('.', ',')}` : 'A calcular'}
          </span>
        </div>

        <div className="border-t border-[#262626] pt-3 flex justify-between items-center text-sm font-bold">
          <span className="text-white">Total a Pagar</span>
          <span className="text-lg text-[#F59E0B]">
            R$ {total.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>
    </div>
  );
}
