'use client';

import React, { useEffect, useState } from 'react';
import { Produto } from '@/types/storefront';
import { ProductCard } from './ProductCard';
import { supabase } from '@/services/supabaseClient';
import { PackageSearch } from 'lucide-react';

export interface ProductGridProps {
  selectedCategorySlug: string;
  initialProdutos?: Produto[];
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  selectedCategorySlug,
  initialProdutos,
}) => {
  const [produtos, setProdutos] = useState<Produto[]>(initialProdutos || []);
  const [loading, setLoading] = useState<boolean>(!initialProdutos);

  useEffect(() => {
    async function fetchProdutos() {
      setLoading(true);
      try {
        // Tenta buscar da view com preços vigentes e promoções ativas
        const { data: viewData, error: viewError } = await supabase
          .from('vw_produtos_vitrine')
          .select('*')
          .eq('ativo', true);

        if (!viewError && viewData && viewData.length > 0) {
          const mapped: Produto[] = (viewData as Record<string, unknown>[]).map((item) => ({
            ...(item as unknown as Produto),
            preco: Number(item.preco_vigente ?? item.preco_original ?? item.preco ?? 0),
            preco_original: Number(item.preco_original ?? item.preco ?? 0),
            preco_vigente: Number(item.preco_vigente ?? item.preco ?? 0),
            em_promocao: Boolean(item.em_promocao),
            percentual_desconto: Number(item.percentual_desconto || 0),
          }));
          setProdutos(mapped);
          return;
        }

        // Fallback para a tabela oficial de produtos caso a view ainda não tenha sido compilada
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('ativo', true)
          .order('destaque', { ascending: false });

        if (!error && data && data.length > 0) {
          setProdutos(
            (data as Record<string, unknown>[]).map((p) => ({
              ...(p as unknown as Produto),
              preco_original: Number(p.preco || 0),
              preco_vigente: Number(p.preco || 0),
              em_promocao: false,
              percentual_desconto: 0,
            }))
          );
        } else {
          setProdutos([]);
        }
      } catch (err) {
        console.error('Erro ao buscar produtos no Supabase:', err);
        setProdutos([]);
      } finally {
        setLoading(false);
      }
    }

    if (!initialProdutos) {
      fetchProdutos();
    }
  }, [initialProdutos]);

  // Filtragem dinâmica por Categoria
  const produtosFiltrados = produtos.filter((prod) => {
    if (selectedCategorySlug === 'todas') return true;
    return prod.categoria_id === selectedCategorySlug;
  });

  return (
    <section className="w-full bg-[#0D0D0D] py-8 sm:py-12 min-h-[400px]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Skeleton Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-[#262626] bg-[#161616] p-4 animate-pulse h-80"
              >
                <div className="aspect-square w-full rounded-xl bg-[#222222]" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[#222222]" />
                  <div className="h-3 w-1/2 rounded bg-[#222222]" />
                </div>
                <div className="mt-4 flex items-center justify-between pt-2">
                  <div className="h-6 w-16 rounded bg-[#222222]" />
                  <div className="h-8 w-24 rounded-xl bg-[#222222]" />
                </div>
              </div>
            ))}
          </div>
        ) : produtosFiltrados.length > 0 ? (
          /* Grid de Produtos Oficiais do Banco */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {produtosFiltrados.map((produto, idx) => (
              <ProductCard key={produto.id} produto={produto} isPriority={idx < 4} />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#262626] bg-[#161616] py-16 px-4 text-center">
            <PackageSearch className="h-16 w-16 text-zinc-600 mb-4" />
            <h3 className="text-lg font-bold text-white">Nenhum produto encontrado</h3>
            <p className="mt-1 text-sm text-zinc-400 max-w-sm">
              Não encontramos bebidas cadastradas nesta categoria no momento.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
