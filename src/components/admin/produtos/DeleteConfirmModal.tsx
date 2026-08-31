'use client';

import React from 'react';
import { AlertTriangle, Trash2, EyeOff, X, Loader2 } from 'lucide-react';
import { Produto } from '@/types/storefront';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
  onConfirmDelete: (id: string) => Promise<void>;
  onConfirmInactivate: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  produto,
  onConfirmDelete,
  onConfirmInactivate,
  isDeleting,
}: DeleteConfirmModalProps) {
  if (!isOpen || !produto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#161616] border border-[#262626] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute right-5 top-5 p-2 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header com Ícone de Alerta */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="pr-6">
            <h3 className="text-lg font-black text-white">Excluir Produto</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ação irreversível caso não haja histórico associado.
            </p>
          </div>
        </div>

        {/* Card do Produto Selecionado */}
        <div className="p-3.5 rounded-2xl bg-[#0D0D0D] border border-[#262626] flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#161616] border border-[#262626] overflow-hidden flex items-center justify-center shrink-0">
            {produto.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" />
            ) : (
              <Trash2 className="w-5 h-5 text-zinc-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{produto.nome}</p>
            <p className="text-xs text-[#F59E0B] font-bold">
              R$ {Number(produto.preco).toFixed(2).replace('.', ',')} • Estoque: {produto.estoque_atual} un
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Deseja <strong className="text-white">excluir permanentemente</strong> este produto do catálogo ou prefere apenas <strong className="text-white">ocultá-lo da vitrine</strong> (inativar)?
        </p>

        {/* Botões de Ação */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => onConfirmDelete(produto.id)}
            className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Excluir Definitivamente
              </>
            )}
          </button>

          {produto.ativo && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onConfirmInactivate(produto.id)}
              className="w-full py-3 px-4 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-amber-500/40 text-amber-400 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <EyeOff className="w-4 h-4" />
              Apenas Ocultar da Vitrine (Inativar)
            </button>
          )}

          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-transparent text-zinc-400 hover:text-white font-semibold text-xs transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
