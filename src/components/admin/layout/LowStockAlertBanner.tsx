'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  X,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Produto } from '@/types/storefront';
import { QuickRestockModal } from '@/components/admin/produtos/QuickRestockModal';

export function LowStockAlertBanner() {
  const [criticalProducts, setCriticalProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchCriticalProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('estoque_atual', { ascending: true });

      if (error) throw error;

      const filtered = (data || []).filter(
        (p: Produto) => Number(p.estoque_atual) <= Number(p.estoque_minimo)
      );

      setCriticalProducts(filtered);
    } catch (err) {
      console.error('[LowStockAlertBanner] Erro ao buscar produtos com estoque baixo:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCriticalProducts();

    // Supabase Realtime Subscription para a tabela 'produtos'
    const channel = supabase
      .channel('realtime:produtos:low-stock')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'produtos',
        },
        () => {
          fetchCriticalProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCriticalProducts]);

  if (loading || criticalProducts.length === 0) {
    return null;
  }

  const handleOpenRestock = (productId?: string) => {
    setSelectedProductId(productId || null);
    setIsModalOpen(true);
  };

  const handleRestockSuccess = () => {
    fetchCriticalProducts();
  };

  const esgotadosCount = criticalProducts.filter((p) => p.estoque_atual === 0).length;

  return (
    <>
      <aside
        aria-label="Alerta de Estoque Crítico"
        className="w-full bg-red-950/70 border-b border-red-500/40 backdrop-blur-md px-4 md:px-6 py-2.5 transition-all duration-300 z-30 shrink-0 shadow-lg shadow-red-950/40"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Left: Indicator & Headline */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-red-300">
                  Estoque Crítico
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-300 border border-red-500/30">
                  {criticalProducts.length} {criticalProducts.length === 1 ? 'item' : 'itens'}
                </span>
                {esgotadosCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white animate-pulse">
                    {esgotadosCount} esgotado{esgotadosCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Product Pills / Summary */}
              {!isCollapsed && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none mt-1">
                  {criticalProducts.slice(0, 4).map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleOpenRestock(prod.id)}
                      className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/70 border border-red-500/30 hover:border-red-400/60 text-xs font-semibold text-zinc-200 hover:text-white transition flex items-center gap-1.5 shrink-0"
                      title="Clique para reabastecer este item"
                    >
                      <span className="truncate max-w-[140px] sm:max-w-[200px]">{prod.nome}:</span>
                      <strong className={prod.estoque_atual === 0 ? 'text-red-400' : 'text-amber-400'}>
                        {prod.estoque_atual === 0 ? '0 un' : `apenas ${prod.estoque_atual} un`}
                      </strong>
                    </button>
                  ))}

                  {criticalProducts.length > 4 && (
                    <button
                      type="button"
                      onClick={() => handleOpenRestock()}
                      className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] font-bold text-red-300 hover:text-white shrink-0 transition"
                    >
                      +{criticalProducts.length - 4} outros...
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="p-1.5 rounded-xl bg-black/30 hover:bg-black/60 text-zinc-400 hover:text-white border border-red-500/20 text-xs transition md:hidden"
              title={isCollapsed ? 'Expandir' : 'Recolher'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleOpenRestock()}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-red-600/30 transition transform active:scale-95 cursor-pointer"
            >
              <Boxes className="w-4 h-4" />
              <span>Reabastecer Agora</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Quick Restock Modal */}
      <QuickRestockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedProductId={selectedProductId}
        onSuccess={handleRestockSuccess}
      />
    </>
  );
}
