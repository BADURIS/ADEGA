'use client';

import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore, selectCartItemCount, selectCartSubtotal } from '@/store/useCartStore';
import { useHydrated } from '@/hooks/useHydrated';

export interface FloatingCartBarProps {
  onOpenCart?: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({ onOpenCart }) => {
  const hydrated = useHydrated();
  const itemCount = useCartStore(selectCartItemCount);
  const subtotal = useCartStore(selectCartSubtotal);

  if (!hydrated || itemCount <= 0) return null;

  const formatarPreco = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <div
        onClick={onOpenCart}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenCart?.();
          }
        }}
        className="w-full bg-[#161616]/95 backdrop-blur-md border border-[#F59E0B]/40 rounded-2xl p-3 px-4 shadow-2xl shadow-black/80 flex items-center justify-between cursor-pointer transition-all duration-300 active:scale-[0.98] animate-slide-up"
      >
        {/* Lado Esquerdo: Badge circular com itens + Subtotal */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F59E0B] px-1 text-[11px] font-black text-[#0D0D0D] shadow-md">
              {itemCount}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              {itemCount === 1 ? '1 item' : `${itemCount} itens`}
            </span>
            <span className="text-base font-extrabold text-white">
              {formatarPreco(subtotal)}
            </span>
          </div>
        </div>

        {/* Lado Direito: Botão de ação "Ver Sacola / Finalizar" em verde WhatsApp */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCart?.();
          }}
          className="bg-[#22C55E] hover:bg-[#16a34a] active:bg-emerald-600 text-black font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-[#22C55E]/20 active:scale-95 transition-all focus:outline-none"
        >
          <span>Ver Sacola</span>
          <ArrowRight className="h-4 w-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
