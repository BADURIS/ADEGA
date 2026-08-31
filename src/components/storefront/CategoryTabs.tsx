'use client';

import React from 'react';
import { Categoria } from '@/types/storefront';

export interface CategoryTabsProps {
  categorias?: Categoria[];
  selectedCategorySlug: string;
  onSelectCategory: (slug: string) => void;
}

export const CATEGORIAS_PADRAO: Categoria[] = [
  { id: 'todas', nome: 'Todas', slug: 'todas', ativo: true },
  { id: 'cervejas', nome: 'Cervejas', slug: 'cervejas', ativo: true },
  { id: 'destilados', nome: 'Destilados', slug: 'destilados', ativo: true },
  { id: 'energeticos', nome: 'Energéticos', slug: 'energeticos', ativo: true },
  { id: 'gelo-saborizado', nome: 'Gelo Saborizado', slug: 'gelo-saborizado', ativo: true },
  { id: 'combos', nome: 'Combos Especiais', slug: 'combos', ativo: true },
];

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categorias = CATEGORIAS_PADRAO,
  selectedCategorySlug,
  onSelectCategory,
}) => {
  return (
    <section id="categorias" className="w-full bg-[#0D0D0D] py-6 border-b border-[#262626]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Categorias em Destaque
          </h2>
        </div>

        {/* Container com Scroll Horizontal */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
          {categorias.map((cat) => {
            const isSelected = selectedCategorySlug === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.slug)}
                type="button"
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 shrink-0 ${
                  isSelected
                    ? 'bg-[#F59E0B] text-[#0D0D0D] shadow-lg shadow-[#F59E0B]/20 scale-105'
                    : 'bg-[#161616] text-[#A1A1AA] border border-[#262626] hover:bg-[#222222] hover:text-white'
                }`}
              >
                {cat.nome}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
