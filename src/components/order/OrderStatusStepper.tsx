'use client';

import React from 'react';
import { Clock, PackageCheck, Bike, CheckCircle2, XCircle } from 'lucide-react';
import { StatusPedido } from '@/types/storefront';

interface OrderStatusStepperProps {
  status: StatusPedido;
  formaPagamento?: string;
}

const STEPS = [
  {
    key: 'recebido',
    label: 'Pedido Recebido',
    description: 'Aguardando confirmação',
    icon: Clock,
  },
  {
    key: 'em_preparo',
    label: 'Em Preparo',
    description: 'Separando & Gelando bebidas',
    icon: PackageCheck,
  },
  {
    key: 'em_rota',
    label: 'Em Rota',
    description: 'Motoboy a caminho da sua porta',
    icon: Bike,
  },
  {
    key: 'entregue',
    label: 'Entregue',
    description: 'Bebidas geladas entregues com sucesso!',
    icon: CheckCircle2,
  },
];

function getActiveStepIndex(status: StatusPedido): number {
  switch (status) {
    case 'aguardando_pagamento':
    case 'pendente_aprovacao':
      return 0;
    case 'em_preparo':
      return 1;
    case 'em_rota':
      return 2;
    case 'entregue':
      return 3;
    case 'cancelado':
      return -1;
    default:
      return 0;
  }
}

export function OrderStatusStepper({ status }: OrderStatusStepperProps) {
  if (status === 'cancelado') {
    return (
      <div className="bg-[#161616] border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-red-400">Pedido Cancelado</h3>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Este pedido foi cancelado. Se tiver dúvidas, entre em contato com nosso atendimento via WhatsApp.
        </p>
      </div>
    );
  }

  const activeIndex = getActiveStepIndex(status);

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 md:p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-[#262626] pb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Acompanhamento em Tempo Real
        </h3>
        <span className="px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
          Ao Vivo
        </span>
      </div>

      <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#262626]">
        {STEPS.map((step, index) => {
          const isCompleted = index < activeIndex;
          const isCurrent = index === activeIndex;

          return (
            <div key={step.key} className="relative flex items-start gap-4">
              {/* Point icon indicator */}
              <div
                className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border text-xs transition ${
                  isCompleted
                    ? 'bg-[#22C55E] border-[#22C55E] text-[#0D0D0D]'
                    : isCurrent
                    ? 'bg-[#F59E0B] border-[#F59E0B] text-[#0D0D0D] shadow-lg shadow-[#F59E0B]/30 animate-bounce'
                    : 'bg-[#0D0D0D] border-[#262626] text-zinc-600'
                }`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4
                    className={`font-bold text-sm ${
                      isCurrent
                        ? 'text-[#F59E0B]'
                        : isCompleted
                        ? 'text-white'
                        : 'text-zinc-500'
                    }`}
                  >
                    {step.label}
                  </h4>
                  {isCurrent && (
                    <span className="px-2 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-bold rounded">
                      Status Atual
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
