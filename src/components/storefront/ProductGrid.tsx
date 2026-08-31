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

// Produtos Mock de alta qualidade para fallback instantâneo caso a tabela do Supabase esteja vazia ou em setup inicial
const PRODUTOS_MOCK: Produto[] = [
  {
    id: 'prod-1',
    categoria_id: 'cervejas',
    nome: 'Heineken Long Neck 330ml (Gelada)',
    descricao: 'Cerveja Premium Lager puro malte refrescante trincando de gelada.',
    preco: 9.90,
    preco_original: 9.90,
    preco_vigente: 7.90,
    em_promocao: true,
    percentual_desconto: 20,
    foto_url: '/products/heineken-long-neck.png',
    estoque_atual: 48,
    estoque_minimo: 10,
    ativo: true,
    destaque: true,
  },
  {
    id: 'prod-2',
    categoria_id: 'cervejas',
    nome: 'Amstel Cerveja Lata 350ml',
    descricao: 'Cerveja Puro Malte receita holandesa tradicional.',
    preco: 4.50,
    preco_original: 4.50,
    preco_vigente: 4.50,
    em_promocao: false,
    foto_url: '/products/amstel-lata.png',
    estoque_atual: 120,
    estoque_minimo: 20,
    ativo: true,
  },
  {
    id: 'prod-3',
    categoria_id: 'destilados',
    nome: 'Whisky Red Label 1L',
    descricao: 'Whisky Escocês Johnnie Walker Red Label Garrafa 1 Litro.',
    preco: 99.90,
    preco_original: 99.90,
    preco_vigente: 99.90,
    em_promocao: false,
    foto_url: '/products/red-label-whisky.png',
    estoque_atual: 5,
    estoque_minimo: 6,
    ativo: true,
    destaque: true,
  },
  {
    id: 'prod-4',
    categoria_id: 'destilados',
    nome: 'Vodka Absolut Original 1L',
    descricao: 'Vodka Sueca pura e refinada 1 Litro.',
    preco: 84.90,
    preco_original: 84.90,
    preco_vigente: 84.90,
    em_promocao: false,
    foto_url: '/products/absolut-vodka.png',
    estoque_atual: 12,
    estoque_minimo: 5,
    ativo: true,
  },
  {
    id: 'prod-5',
    categoria_id: 'energeticos',
    nome: 'Energético Red Bull Energy Drink 250ml',
    descricao: 'Red Bull te dá asas. Lata 250ml gelada.',
    preco: 11.90,
    preco_original: 11.90,
    preco_vigente: 11.90,
    em_promocao: false,
    foto_url: '/products/red-bull-can.png',
    estoque_atual: 30,
    estoque_minimo: 10,
    ativo: true,
  },
  {
    id: 'prod-6',
    categoria_id: 'gelo-saborizado',
    nome: 'Gelo Saborizado Coco com Limão 200g',
    descricao: 'Gelo saborizado para drinks de gin e whisky.',
    preco: 4.90,
    preco_original: 4.90,
    preco_vigente: 4.90,
    em_promocao: false,
    foto_url: '/products/gelo-saborizado-coco-limao.png',
    estoque_atual: 40,
    estoque_minimo: 15,
    ativo: true,
  },
  {
    id: 'prod-7',
    categoria_id: 'combos',
    nome: 'Combo Cavalo Branco + 4 Red Bull',
    descricao: '1 Garrafa Whisky White Horse 1L + 4 Energéticos Red Bull 250ml.',
    preco: 139.90,
    preco_original: 139.90,
    preco_vigente: 109.90,
    em_promocao: true,
    percentual_desconto: 21,
    foto_url: '/products/combo-cavalo-branco-redbull.png',
    estoque_atual: 8,
    estoque_minimo: 3,
    ativo: true,
    destaque: true,
  },
  {
    id: 'prod-8',
    categoria_id: 'cervejas',
    nome: 'Cerveja Corona Extra 330ml',
    descricao: 'Cerveja tipo American Adjunct Lager.',
    preco: 8.90,
    preco_original: 8.90,
    preco_vigente: 8.90,
    em_promocao: false,
    foto_url: '/products/corona-extra.png',
    estoque_atual: 0,
    estoque_minimo: 5,
    ativo: true,
  },
];

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

        // Fallback para tabela padrão caso a view não exista ainda no banco
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('ativo', true)
          .order('destaque', { ascending: false });

        if (error || !data || data.length === 0) {
          setProdutos(PRODUTOS_MOCK);
        } else {
          setProdutos(
            (data as Record<string, unknown>[]).map((p) => ({
              ...(p as unknown as Produto),
              preco_original: Number(p.preco || 0),
              preco_vigente: Number(p.preco || 0),
              em_promocao: false,
              percentual_desconto: 0,
            }))
          );
        }
      } catch (err) {
        console.error('Erro ao buscar produtos no Supabase:', err);
        setProdutos(PRODUTOS_MOCK);
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
          /* Grid de Produtos */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {produtosFiltrados.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
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
