'use client';

import React from 'react';
import Image from 'next/image';
import { Plus, Minus, AlertTriangle, Wine, Sparkles } from 'lucide-react';
import { Produto } from '@/types/storefront';
import { useCartStore } from '@/store/useCartStore';
import { useHydrated } from '@/hooks/useHydrated';

export interface ProductCardProps {
  produto: Produto;
}

export const ProductCard: React.FC<ProductCardProps> = ({ produto }) => {
  const hydrated = useHydrated();
  const itens = useCartStore((state) => state.itens);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const cartItem = hydrated
    ? itens.find((item) => item.produto.id === produto.id)
    : undefined;
  const quantidadeNoCarrinho = cartItem ? cartItem.quantidade : 0;

  const isEsgotado = !produto.ativo || produto.estoque_atual <= 0;
  const isEstoqueBaixo =
    !isEsgotado && produto.estoque_atual <= produto.estoque_minimo;

  const precoVigente = produto.preco_vigente ?? produto.preco;
  const precoOriginal = produto.preco_original ?? produto.preco;
  const emPromocao = Boolean(produto.em_promocao && precoVigente < precoOriginal);

  const formatarPreco = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleAdd = () => {
    if (isEsgotado) return;
    addItem(produto, 1);
  };

  const handleIncrement = () => {
    if (quantidadeNoCarrinho < produto.estoque_atual) {
      updateQuantity(produto.id, quantidadeNoCarrinho + 1);
    }
  };

  const handleDecrement = () => {
    updateQuantity(produto.id, quantidadeNoCarrinho - 1);
  };

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#262626] bg-[#161616] p-4 transition-all duration-300 hover:border-[#F59E0B]/40 hover:shadow-xl hover:shadow-[#F59E0B]/5">
      {/* Badges de Promoção (PROMO DO DIA + Desconto %) */}
      {emPromocao && (
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg shadow-amber-500/20">
            <Sparkles className="w-3 h-3 fill-black" />
            PROMO DO DIA
          </span>
          {produto.percentual_desconto !== undefined && produto.percentual_desconto > 0 && (
            <span className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-md">
              -{produto.percentual_desconto}%
            </span>
          )}
        </div>
      )}

      {/* Badge de Alerta de Estoque Baixo */}
      {isEstoqueBaixo && (
        <div
          className={`absolute z-10 flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-400 border border-amber-500/30 backdrop-blur-md ${
            emPromocao ? 'top-9 left-2.5' : 'top-3 left-3'
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span>Últimas unidades!</span>
        </div>
      )}

      {/* Overlay de Produto Esgotado */}
      {isEsgotado && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0D0D0D]/85 backdrop-blur-[2px]">
          <span className="rounded-xl bg-rose-600/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-lg">
            Esgotado
          </span>
        </div>
      )}

      {/* Container de Imagem do Produto */}
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-[#0D0D0D] p-3 flex items-center justify-center">
        {produto.foto_url ? (
          <Image
            src={produto.foto_url}
            alt={produto.nome}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-600">
            <Wine className="h-12 w-12 stroke-[1.5]" />
            <span className="text-[10px] uppercase font-bold mt-1 text-zinc-600">Adega Teles</span>
          </div>
        )}
      </div>

      {/* Informações do Produto */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#F59E0B] transition-colors">
            {produto.nome}
          </h3>
          {produto.descricao && (
            <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {produto.descricao}
            </p>
          )}
        </div>

        {/* Preço e Botão de Ação */}
        <div className="mt-4 flex items-center justify-between pt-2 border-t border-[#262626]">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase text-zinc-500">Valor</span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {emPromocao && (
                <span className="text-xs text-zinc-500 line-through">
                  {formatarPreco(precoOriginal)}
                </span>
              )}
              <span className="text-base font-extrabold text-[#F59E0B] sm:text-lg">
                {formatarPreco(precoVigente)}
              </span>
            </div>
          </div>

          {/* Seletor de Quantidade ou Botão Adicionar */}
          {quantidadeNoCarrinho > 0 ? (
            <div className="flex items-center gap-1 rounded-xl border border-[#F59E0B]/50 bg-[#0D0D0D] p-1 shadow-inner">
              <button
                onClick={handleDecrement}
                type="button"
                className="flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-[#161616] text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0D0D0D] active:scale-90 transition-all duration-150 focus:outline-none touch-manipulation"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-4 w-4 stroke-[3]" />
              </button>
              <span className="w-7 text-center text-xs sm:text-sm font-black text-white select-none">
                {quantidadeNoCarrinho}
              </span>
              <button
                onClick={handleIncrement}
                disabled={quantidadeNoCarrinho >= produto.estoque_atual}
                type="button"
                className="flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-[#F59E0B] text-[#0D0D0D] hover:bg-[#D97706] disabled:opacity-40 active:scale-90 transition-all duration-150 focus:outline-none touch-manipulation"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              disabled={isEsgotado}
              type="button"
              className="group/btn relative flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#F59E0B] px-3.5 py-2.5 text-xs font-black text-[#0D0D0D] shadow-md shadow-[#F59E0B]/20 hover:bg-[#D97706] hover:shadow-[#F59E0B]/40 active:scale-95 active:bg-amber-400 disabled:opacity-40 transition-all duration-150 focus:outline-none touch-manipulation"
            >
              <Plus className="h-4 w-4 stroke-[3] transition-transform duration-200 group-hover/btn:rotate-90 group-active/btn:scale-125" />
              <span>Adicionar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
