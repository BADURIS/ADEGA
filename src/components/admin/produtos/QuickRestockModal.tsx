'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import {
  X,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Boxes,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Produto } from '@/types/storefront';

interface QuickRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductId?: string | null;
  onSuccess?: () => void;
}

interface ProductAdjustment {
  produto: Produto;
  delta: number;
  newStock: number;
  isSaving: boolean;
  savedSuccess: boolean;
}

const QUICK_INCREMENTS = [6, 12, 24, 48];

export function QuickRestockModal({
  isOpen,
  onClose,
  selectedProductId,
  onSuccess,
}: QuickRestockModalProps) {
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<Record<string, ProductAdjustment>>({});
  const [globalMessage, setGlobalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchLowStockProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('estoque_atual', { ascending: true });

      if (error) throw error;

      const criticalProducts = (data || []).filter(
        (p: Produto) => p.estoque_atual <= p.estoque_minimo
      );

      const initialMap: Record<string, ProductAdjustment> = {};
      criticalProducts.forEach((p: Produto) => {
        initialMap[p.id] = {
          produto: p,
          delta: 0,
          newStock: p.estoque_atual,
          isSaving: false,
          savedSuccess: false,
        };
      });

      setAdjustments(initialMap);
    } catch (err: unknown) {
      console.error('Erro ao carregar produtos com estoque crítico:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setGlobalMessage(null);
      fetchLowStockProducts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeltaChange = (productId: string, amount: number) => {
    setAdjustments((prev) => {
      const current = prev[productId];
      if (!current) return prev;
      const newDelta = Math.max(-current.produto.estoque_atual, current.delta + amount);
      const newStock = current.produto.estoque_atual + newDelta;
      return {
        ...prev,
        [productId]: {
          ...current,
          delta: newDelta,
          newStock,
          savedSuccess: false,
        },
      };
    });
  };

  const handleDirectStockChange = (productId: string, value: string) => {
    const numeric = parseInt(value, 10);
    const safeValue = isNaN(numeric) ? 0 : Math.max(0, numeric);

    setAdjustments((prev) => {
      const current = prev[productId];
      if (!current) return prev;
      return {
        ...prev,
        [productId]: {
          ...current,
          delta: safeValue - current.produto.estoque_atual,
          newStock: safeValue,
          savedSuccess: false,
        },
      };
    });
  };

  const handleSaveProduct = async (productId: string) => {
    const item = adjustments[productId];
    if (!item || item.newStock === item.produto.estoque_atual) return;

    setAdjustments((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], isSaving: true },
    }));

    try {
      const { error } = await supabase
        .from('produtos')
        .update({
          estoque_atual: item.newStock,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', productId);

      if (error) throw error;

      setAdjustments((prev) => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          produto: { ...prev[productId].produto, estoque_atual: item.newStock },
          delta: 0,
          isSaving: false,
          savedSuccess: true,
        },
      }));

      setGlobalMessage({
        type: 'success',
        text: `Estoque de "${item.produto.nome}" atualizado para ${item.newStock} un com sucesso!`,
      });

      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error(`Erro ao atualizar estoque do produto ${productId}:`, err);
      setAdjustments((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], isSaving: false },
      }));
      const errMessage = err instanceof Error ? err.message : 'Erro de conexão';
      setGlobalMessage({
        type: 'error',
        text: `Falha ao salvar produto: ${errMessage}`,
      });
    }
  };

  const handleSaveAll = async () => {
    const itemsToSave = Object.values(adjustments).filter(
      (item) => item.newStock !== item.produto.estoque_atual
    );

    if (itemsToSave.length === 0) return;

    startTransition(async () => {
      try {
        for (const item of itemsToSave) {
          const { error } = await supabase
            .from('produtos')
            .update({
              estoque_atual: item.newStock,
              atualizado_em: new Date().toISOString(),
            })
            .eq('id', item.produto.id);

          if (error) throw error;
        }

        setGlobalMessage({
          type: 'success',
          text: `${itemsToSave.length} produto(s) reabastecido(s) com sucesso!`,
        });

        if (onSuccess) onSuccess();
        fetchLowStockProducts();
      } catch (err: unknown) {
        console.error('Erro ao salvar lote de estoque:', err);
        const errMessage = err instanceof Error ? err.message : 'Tente novamente.';
        setGlobalMessage({
          type: 'error',
          text: `Erro ao salvar em lote: ${errMessage}`,
        });
      }
    });
  };

  const adjustmentList = Object.values(adjustments);
  const totalModified = adjustmentList.filter(
    (item) => item.newStock !== item.produto.estoque_atual
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#161616] border border-[#262626] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#262626] flex items-center justify-between bg-[#1A1A1A]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444]">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Reabastecimento Rápido</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                  Estoque Crítico
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Adicione fardos e unidades diretamente sem sair da sua tela atual
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Alert */}
        {globalMessage && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
              globalMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {globalMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{globalMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalMessage(null)}
              className="text-zinc-400 hover:text-white ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin mx-auto" />
              <p className="text-sm text-zinc-400 font-medium">Buscando produtos em nível crítico...</p>
            </div>
          ) : adjustmentList.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#0D0D0D] rounded-2xl border border-[#262626] p-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Tudo abastecido!</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Nenhum produto ativo está abaixo do limite mínimo de estoque configurado no momento.
              </p>
            </div>
          ) : (
            adjustmentList.map((item) => {
              const isSelected = selectedProductId === item.produto.id;
              const hasChanges = item.newStock !== item.produto.estoque_atual;
              const isEsgotado = item.produto.estoque_atual === 0;

              return (
                <div
                  key={item.produto.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 ${
                    isSelected
                      ? 'bg-red-950/20 border-red-500/40 shadow-lg shadow-red-500/5'
                      : hasChanges
                      ? 'bg-[#1C1C1C] border-[#F59E0B]/40'
                      : 'bg-[#0D0D0D] border-[#262626] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Product Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {item.produto.foto_url ? (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#262626] shrink-0">
                          <Image
                            src={item.produto.foto_url}
                            alt={item.produto.nome}
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-[#262626] flex items-center justify-center text-zinc-500 shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white truncate">
                            {item.produto.nome}
                          </h4>
                          {isEsgotado ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                              Esgotado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Mín: {item.produto.estoque_minimo} un
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                          <span>
                            Estoque Atual:{' '}
                            <strong className={isEsgotado ? 'text-red-400' : 'text-amber-400'}>
                              {item.produto.estoque_atual} un
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Preço:{' '}
                            <strong className="text-zinc-200">
                              R$ {Number(item.produto.preco).toFixed(2).replace('.', ',')}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Increment controls & direct save */}
                    <div className="flex items-center gap-3 self-end md:self-center">
                      {/* Quick Add Pills */}
                      <div className="flex items-center gap-1">
                        {QUICK_INCREMENTS.map((inc) => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => handleDeltaChange(item.produto.id, inc)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#F59E0B]/20 border border-[#262626] hover:border-[#F59E0B]/50 text-xs font-black text-zinc-300 hover:text-[#F59E0B] transition"
                            title={`Adicionar +${inc} unidades`}
                          >
                            +{inc}
                          </button>
                        ))}
                      </div>

                      {/* Number Stepper */}
                      <div className="flex items-center bg-[#161616] border border-[#262626] rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => handleDeltaChange(item.produto.id, -1)}
                          disabled={item.newStock <= 0}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-30"
                          title="Diminuir 1"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={item.newStock}
                          onChange={(e) => handleDirectStockChange(item.produto.id, e.target.value)}
                          className="w-14 text-center bg-transparent text-xs font-black text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />

                        <button
                          type="button"
                          onClick={() => handleDeltaChange(item.produto.id, 1)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                          title="Aumentar 1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Individual Save Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveProduct(item.produto.id)}
                        disabled={!hasChanges || item.isSaving}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                          item.savedSuccess
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                            : hasChanges
                            ? 'bg-[#F59E0B] hover:bg-[#d97706] text-black font-extrabold shadow-lg shadow-[#F59E0B]/20'
                            : 'bg-zinc-800/40 border border-transparent text-zinc-600 cursor-not-allowed'
                        }`}
                        title="Salvar alteração para este produto"
                      >
                        {item.isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : item.savedSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Salvo</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#262626] flex items-center justify-between bg-[#1A1A1A]/60 shrink-0">
          <div className="text-xs text-zinc-400">
            {totalModified > 0 ? (
              <span className="text-[#F59E0B] font-bold">
                ⚠️ {totalModified} produto(s) com alterações pendentes
              </span>
            ) : (
              <span>Selecione quantidades e salve para restabelecer o estoque</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs font-bold text-zinc-400 hover:text-white transition"
            >
              Fechar
            </button>

            {totalModified > 0 && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-[#22C55E]/20 transition disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando todos...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Salvar Todos ({totalModified})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
