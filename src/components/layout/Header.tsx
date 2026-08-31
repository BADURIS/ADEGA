'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, MessageCircle } from 'lucide-react';
import { useCartStore, selectCartItemCount } from '@/store/useCartStore';
import { useHydrated } from '@/hooks/useHydrated';
import { checkStoreOpeningStatus, StoreStatusResult } from '@/lib/storeStatus';
import { supabase } from '@/services/supabaseClient';

export interface HeaderProps {
  onOpenCart?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCart }) => {
  const hydrated = useHydrated();
  const rawItemCount = useCartStore(selectCartItemCount);
  const itemCount = hydrated ? rawItemCount : 0;

  const [status, setStatus] = useState<StoreStatusResult>(() => checkStoreOpeningStatus());

  useEffect(() => {
    async function loadStoreConfig() {
      try {
        const { data } = await supabase.from('configuracoes_adega').select('chave, valor');
        if (data && data.length > 0) {
          const configMap: Record<string, string> = {};
          data.forEach((item) => {
            configMap[item.chave] = item.valor;
          });

          const ab = configMap['horario_abertura'] || '18:00';
          const fe = configMap['horario_fechamento'] || '02:00';
          const st = (configMap['status_manual'] as any) || 'auto';

          setStatus(checkStoreOpeningStatus(ab, fe, st));
        }
      } catch (err) {
        console.error('Erro ao buscar configurações de horário:', err);
      }
    }

    loadStoreConfig();
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

          {/* Badge de Status Dinâmico da Loja (Com suporte a travessia de meia-noite) */}
          <div
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold sm:flex ${status.badgeCor}`}
          >
            {status.aberto ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span>{status.statusTexto} • {status.horarioTexto}</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span>{status.statusTexto} • {status.horarioTexto}</span>
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
