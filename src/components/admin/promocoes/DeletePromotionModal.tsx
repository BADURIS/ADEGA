'use client';

import React from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { Promocao } from '@/types/promocoes';

interface DeletePromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  promocao: Promocao | null;
  isDeleting: boolean;
}

export function DeletePromotionModal({
  isOpen,
  onClose,
  onConfirm,
  promocao,
  isDeleting,
}: DeletePromotionModalProps) {
  if (!isOpen || !promocao) return null;

  const precoPromo = Number(promocao.preco_promocional);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-[#161616] border border-[#262626] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-zinc-400 hover:text-white rounded-xl bg-[#0D0D0D] border border-[#262626] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-black text-white">Excluir Promoção</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Tem certeza de que deseja remover esta regra de promoção?
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#262626] space-y-2 text-xs">
          <p className="text-zinc-300">
            <strong className="text-white">Produto:</strong>{' '}
            {promocao.produto?.nome || 'Produto vinculado'}
          </p>
          <p className="text-zinc-300">
            <strong className="text-white">Preço Promocional:</strong> R${' '}
            {precoPromo.toFixed(2).replace('.', ',')}
          </p>
          <div className="pt-2 border-t border-[#262626] flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>O produto voltará ao preço original padrão na vitrine.</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-300 hover:text-white font-bold text-xs transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onConfirm(promocao.id)}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-lg shadow-red-600/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
