'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, MessageCircle } from 'lucide-react';
import { useCartStore, selectCartItemCount } from '@/store/useCartStore';
import { useHydrated } from '@/hooks/useHydrated';

export interface HeaderProps {
  onOpenCart?: () => void;
}

/**
 * Funçao auxiliar para checar se a adega está aberta.
 * Regra: Quinta a Domingo, das 18h às 03h da manhã seguinte.
 */
function checkIsStoreOpen(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 4 = Quinta, 5 = Sexta, 6 = Sábado
  const hour = now.getHours();

  // Dias ativos de abertura: Quinta (4), Sexta (5), Sábado (6), Domingo (0)
  // Das 18h às 23h59
  if ([4, 5, 6, 0].includes(day) && hour >= 18) {
    return true;
  }

  // Das 00h às 03h da madrugada (referente às noites de Quinta, Sexta, Sábado ou Domingo)
  // Se for Quinta de madrugada (dia 4, 00h-03h), refere-se à noite de Quarta.
  // Se for Sexta (5), Sábado (6), Domingo (0) ou Segunda (1) das 00h às 03h:
  if ([5, 6, 0, 1].includes(day) && hour < 3) {
    return true;
  }

  return false;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCart }) => {
  const hydrated = useHydrated();
  const rawItemCount = useCartStore(selectCartItemCount);
  const itemCount = hydrated ? rawItemCount : 0;

  const [isOpen, setIsOpen] = useState<boolean>(true);

  useEffect(() => {
    setIsOpen(checkIsStoreOpen());
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#262626] bg-[#0D0D0D]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo & Marca */}
        <div className="flex items-center gap-3">
          <a href="#" className="group flex items-center gap-2 focus:outline-none">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-[#0D0D0D] shadow-md shadow-[#F59E0B]/20 transition-transform group-hover:scale-105">
              <span className="font-mono text-xl font-black tracking-tighter">TA</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold uppercase tracking-wide text-white sm:text-lg">
                Teles Adega <span className="text-[#F59E0B]">Delivery</span>
              </span>
              <span className="text-[10px] font-medium tracking-wider text-zinc-400">
                BAIXADA SANTISTA (13)
              </span>
            </div>
          </a>

          {/* Badge de Status da Loja */}
          <div className="hidden items-center gap-1.5 rounded-full border border-[#262626] bg-[#161616] px-3 py-1 text-xs font-medium sm:flex">
            {isOpen ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400">Aberto Agora</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span className="text-zinc-400">Abre às 18h</span>
              </>
            )}
          </div>
        </div>

        {/* Ações & Contato */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Link Oficial do WhatsApp */}
          <a
            href="https://wa.me/5513997650605?text=Ol%C3%A1%2C%20gostaria%20de%20fazer%20um%20pedido%20na%20Teles%20Adega!"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#161616] px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-[#22C55E]/40 hover:bg-[#22C55E]/10 hover:text-[#22C55E] sm:px-3.5 sm:text-sm"
            title="Atendimento via WhatsApp"
          >
            <MessageCircle className="h-4 w-4 text-[#22C55E]" />
            <span className="hidden sm:inline">(13) 99765-0605</span>
          </a>

          {/* Botão do Carrinho */}
          <button
            onClick={onOpenCart}
            type="button"
            className="relative flex items-center justify-center rounded-xl bg-[#F59E0B] p-2.5 text-[#0D0D0D] font-bold shadow-lg shadow-[#F59E0B]/20 transition-all hover:bg-[#D97706] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50"
            aria-label="Abrir carrinho de compras"
          >
            <ShoppingBag className="h-5 w-5 stroke-[2.5]" />
            {itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-black text-white shadow-md animate-pulse">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
