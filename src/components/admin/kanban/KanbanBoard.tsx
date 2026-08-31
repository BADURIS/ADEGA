'use client';

import React, { useState } from 'react';
import { KanbanOrderCard } from './KanbanOrderCard';
import { Pedido } from '@/types/storefront';

export interface KanbanBoardProps {
  pedidos: Pedido[];
  onAprovarPedido: (id: string) => void;
  onRecusarPedido: (id: string) => void;
  onAtribuirMotoboy: (id: string) => void;
  onValidarCodigo: (id: string, codigo?: string) => void;
}

const COLUMNS = [
  {
    id: 'pendentes',
    title: '1. Novos / Pendentes',
    shortTitle: 'Pendentes',
    color: '#F59E0B',
    bgBadge: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
    statuses: ['pendente_aprovacao', 'aguardando_pagamento'],
  },
  {
    id: 'em_preparo',
    title: '2. Em Preparo',
    shortTitle: 'Em Preparo',
    color: '#3B82F6',
    bgBadge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    statuses: ['em_preparo'],
  },
  {
    id: 'em_rota',
    title: '3. Em Rota',
    shortTitle: 'Em Rota',
    color: '#8B5CF6',
    bgBadge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    statuses: ['em_rota'],
  },
  {
    id: 'concluidos',
    title: '4. Concluídos',
    shortTitle: 'Concluídos',
    color: '#22C55E',
    bgBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    statuses: ['entregue'],
  },
  {
    id: 'cancelados',
    title: '5. Cancelados',
    shortTitle: 'Cancelados',
    color: '#EF4444',
    bgBadge: 'bg-red-500/10 text-red-400 border-red-500/30',
    statuses: ['cancelado'],
  },
];

export function KanbanBoard({
  pedidos,
  onAprovarPedido,
  onRecusarPedido,
  onAtribuirMotoboy,
  onValidarCodigo,
}: KanbanBoardProps) {
  // Mobile Tab Selection state: 'all' or column id
  const [selectedMobileTab, setSelectedMobileTab] = useState<string>('all');

  // Filter columns to render on mobile
  const visibleColumns =
    selectedMobileTab === 'all'
      ? COLUMNS
      : COLUMNS.filter((col) => col.id === selectedMobileTab);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Mobile Tab Selector Header (md:hidden) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-[#262626]">
        <button
          type="button"
          onClick={() => setSelectedMobileTab('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
            selectedMobileTab === 'all'
              ? 'bg-[#F59E0B] text-[#0D0D0D] border-[#F59E0B]'
              : 'bg-[#161616] text-zinc-400 border-[#262626] hover:text-white'
          }`}
        >
          <span>Todas ({pedidos.length})</span>
        </button>

        {COLUMNS.map((col) => {
          const count = pedidos.filter((p) => col.statuses.includes(p.status)).length;
          const isSelected = selectedMobileTab === col.id;

          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setSelectedMobileTab(col.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-[#222222] text-white border-zinc-500 shadow-md'
                  : 'bg-[#161616] text-zinc-400 border-[#262626] hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: col.color }}
              />
              <span>{col.shortTitle}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#262626] text-zinc-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Columns Container */}
      <div className="flex-1 overflow-x-auto snap-x snap-mandatory flex gap-4 pb-6 md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-x-visible md:snap-none items-start">
        {visibleColumns.map((col) => {
          const columnOrders = pedidos.filter((p) => col.statuses.includes(p.status));

          return (
            <div
              key={col.id}
              className="bg-[#161616] border border-[#262626] rounded-2xl p-4 flex flex-col max-h-[calc(100vh-160px)] min-w-[85vw] sm:min-w-[320px] md:min-w-0 md:w-full flex-shrink-0 md:flex-shrink snap-center transition-all"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  {col.title}
                </h3>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${col.bgBadge}`}
                >
                  {columnOrders.length}
                </span>
              </div>

              {/* Column Order List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {columnOrders.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-[#262626] rounded-xl text-xs text-zinc-500">
                    Nenhum pedido nesta etapa
                  </div>
                ) : (
                  columnOrders.map((pedido) => (
                    <KanbanOrderCard
                      key={pedido.id}
                      pedido={pedido}
                      onAprovar={onAprovarPedido}
                      onRecusar={onRecusarPedido}
                      onAtribuirMotoboy={onAtribuirMotoboy}
                      onValidarCodigo={onValidarCodigo}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
