'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Wine } from 'lucide-react';
import {
  useCartStore,
  selectCartItemCount,
  selectCartSubtotal,
} from '@/store/useCartStore';
import { useHydrated } from '@/hooks/useHydrated';

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const hydrated = useHydrated();
  const itens = useCartStore((state) => state.itens);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const rawSubtotal = useCartStore(selectCartSubtotal);
  const rawTotalItens = useCartStore(selectCartItemCount);

  if (!isOpen) return null;

  const cartItens = hydrated ? itens : [];
  const subtotal = hydrated ? rawSubtotal : 0;
  const totalItens = hydrated ? rawTotalItens : 0;

  const formatarPreco = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop semi-transparente escuro */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#0D0D0D]/80 backdrop-blur-sm transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10 w-full sm:w-auto">
        {/* Container do Drawer (Slide-over) */}
        <div className="relative w-full max-w-md border-l border-[#262626] bg-[#161616] shadow-2xl flex flex-col justify-between h-full overflow-hidden">
          
          {/* Header do Drawer */}
          <div className="flex items-center justify-between border-b border-[#262626] p-4 sm:px-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F59E0B]/10 text-[#F59E0B]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white truncate">Sua Sacola</h2>
                <p className="text-xs text-zinc-400 truncate">
                  {totalItens === 1 ? '1 item adicionado' : `${totalItens} itens adicionados`}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="rounded-xl p-2 text-zinc-400 hover:bg-[#222222] hover:text-white transition-colors focus:outline-none"
              aria-label="Fechar sacola"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lista de Itens do Carrinho */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {cartItens.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0D0D0D] border border-[#262626] text-zinc-600 mb-4">
                  <ShoppingBag className="h-8 w-8 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-bold text-white">Sua sacola está vazia</h3>
                <p className="mt-1 text-xs text-zinc-400 max-w-xs">
                  Adicione cervejas geladas, destilados ou combos para iniciar o seu pedido.
                </p>
              </div>
            ) : (
              cartItens.map((item) => (
                <div
                  key={item.produto.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#0D0D0D] p-3 transition-colors hover:border-[#262626]/80"
                >
                  {/* Thumbnail do Produto */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#161616] flex items-center justify-center border border-[#262626]">
                    {item.produto.foto_url ? (
                      <Image
                        src={item.produto.foto_url}
                        alt={item.produto.nome}
                        fill
                        className="object-contain p-1"
                      />
                    ) : (
                      <Wine className="h-6 w-6 text-zinc-600" />
                    )}
                  </div>

                  {/* Nome e Preços */}
                  <div className="flex flex-1 flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white truncate">
                        {item.produto.nome}
                      </h4>
                      {item.produto.em_promocao && (
                        <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-[#F59E0B] border border-amber-500/30">
                          Promo
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {formatarPreco(item.precoUnitario)} un.
                    </span>
                    <span className="text-xs font-extrabold text-[#F59E0B] mt-0.5">
                      {formatarPreco(item.subtotal)}
                    </span>
                  </div>

                  {/* Controles de Quantidade & Lixeira */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 rounded-lg border border-[#262626] bg-[#161616] p-1">
                      <button
                        onClick={() => updateQuantity(item.produto.id, item.quantidade - 1)}
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-[#222222] hover:text-white transition-colors"
                        aria-label="Diminuir"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-white">
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.produto.id, item.quantidade + 1)}
                        disabled={item.quantidade >= item.produto.estoque_atual}
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0D0D0D] disabled:opacity-30 transition-colors"
                        aria-label="Aumentar"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.produto.id)}
                      type="button"
                      className="p-1.5 text-zinc-500 hover:text-rose-500 transition-colors"
                      aria-label="Remover produto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé Fixo do Drawer */}
          {cartItens.length > 0 && (
            <div className="border-t border-[#262626] bg-[#0D0D0D] p-4 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Subtotal dos produtos</span>
                  <span className="font-semibold text-white">{formatarPreco(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Taxa de Entrega</span>
                  <span className="text-[11px] italic text-zinc-500">Calculada no checkout</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#262626] pt-2 text-sm font-extrabold text-white">
                  <span>Subtotal Parcial</span>
                  <span className="text-base font-black text-[#F59E0B]">{formatarPreco(subtotal)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#22C55E] px-5 py-3.5 text-sm font-black text-[#0D0D0D] shadow-lg shadow-[#22C55E]/20 hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  <span>Ir para o Checkout</span>
                  <ArrowRight className="h-4 w-4 stroke-[3] transition-transform group-hover:translate-x-1" />
                </Link>

                <button
                  onClick={clearCart}
                  type="button"
                  className="w-full py-2 text-center text-xs font-semibold text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  Esvaziar Sacola
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
