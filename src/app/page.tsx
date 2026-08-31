'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/storefront/HeroSection';
import { CategoryTabs, CATEGORIAS_PADRAO } from '@/components/storefront/CategoryTabs';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { FloatingCartBar } from '@/components/storefront/FloatingCartBar';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { Categoria, Produto } from '@/types/storefront';
import { supabase } from '@/services/supabaseClient';
import { Wine, MessageCircle, ShieldCheck, Heart } from 'lucide-react';

export default function HomePage() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('todas');
  const [categorias, setCategorias] = useState<Categoria[]>(CATEGORIAS_PADRAO);
  const [produtos, setProdutos] = useState<Produto[] | undefined>(undefined);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch active categories
        const { data: catData } = await supabase
          .from('categorias')
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true });

        if (catData && catData.length > 0) {
          const mappedCat: Categoria[] = [
            { id: 'todas', nome: 'Todas', slug: 'todas', ativo: true },
            ...(catData as Categoria[]).map((c) => ({
              id: c.id,
              nome: c.nome,
              slug: c.slug || c.id,
              ativo: c.ativo,
            })),
          ];
          setCategorias(mappedCat);
        }

        // Fetch active products from view or fallback
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
        } else {
          const { data: prodData } = await supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('destaque', { ascending: false });

          if (prodData && prodData.length > 0) {
            setProdutos(
              (prodData as Record<string, unknown>[]).map((p) => ({
                ...(p as unknown as Produto),
                preco_original: Number(p.preco || 0),
                preco_vigente: Number(p.preco || 0),
                em_promocao: false,
                percentual_desconto: 0,
              }))
            );
          }
        }
      } catch (err: unknown) {
        console.error('Erro ao carregar dados da vitrine no Supabase:', err);
      }
    }

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans selection:bg-[#F59E0B] selection:text-[#0D0D0D]">
      {/* 1. Sticky Header */}
      <Header onOpenCart={() => setIsCartOpen(true)} />

      {/* Main Storefront Content with bottom padding to ensure floating cart bar doesn't obscure content */}
      <main className="flex-1 pb-28 md:pb-12">
        {/* 2. Hero Section */}
        <HeroSection />

        {/* 3. Category Tabs Selector */}
        <CategoryTabs
          categorias={categorias}
          selectedCategorySlug={selectedCategorySlug}
          onSelectCategory={(slug) => setSelectedCategorySlug(slug)}
        />

        {/* 4. Product Showcase Grid */}
        <ProductGrid
          selectedCategorySlug={selectedCategorySlug}
          initialProdutos={produtos}
        />
      </main>

      {/* 5. Mobile Floating Cart Bar */}
      <FloatingCartBar onOpenCart={() => setIsCartOpen(true)} />

      {/* 6. Cart Drawer Overlay */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* 6. Footer */}
      <footer className="w-full bg-[#161616] border-t border-[#262626] py-10 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                <Wine className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-white text-base">TELES ADEGA DELIVERY</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
              Sua adega expressa na Baixada Santista. Bebidas trincando de geladas entregues na sua porta com velocidade e confiança.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-3">
              Horário de Atendimento
            </h4>
            <ul className="space-y-1.5 text-xs text-zinc-400">
              <li className="flex items-center justify-between">
                <span>Quinta-feira:</span>
                <span className="font-mono text-zinc-200">18:00 - 03:00</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Sexta-feira:</span>
                <span className="font-mono text-zinc-200">18:00 - 03:00</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Sábado:</span>
                <span className="font-mono text-zinc-200">18:00 - 03:00</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Domingo:</span>
                <span className="font-mono text-zinc-200">18:00 - 03:00</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-3">
              Contato & Suporte
            </h4>
            <a
              href="https://wa.me/5513997650605?text=Ol%C3%A1%2C%20gostaria%20de%20fazer%20um%20pedido%20na%20Teles%20Adega!"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs font-bold hover:bg-[#22C55E]/20 transition mb-3"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp: (13) 99765-0605
            </a>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Pagamento seguro via Pix, Dinheiro ou Fiado</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-[#262626] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} Teles Adega Delivery. Todos os direitos reservados.</p>
          <div className="flex items-center gap-1">
            <span>Desenvolvido com</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>para a Baixada Santista</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
