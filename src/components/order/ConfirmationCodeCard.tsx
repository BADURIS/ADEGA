'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface ConfirmationCodeCardProps {
  codigoEntrega: string;
}

export function ConfirmationCodeCard({ codigoEntrega }: ConfirmationCodeCardProps) {
  const digits = (codigoEntrega || '0000').padStart(4, '0').split('');

  return (
    <div className="flex flex-col items-center justify-center border-2 border-[#F59E0B] bg-[#161616] p-6 rounded-2xl shadow-xl shadow-[#F59E0B]/10 text-center space-y-3">
      <div className="flex items-center gap-2 text-[#F59E0B] text-xs font-bold uppercase tracking-wider">
        <ShieldCheck className="w-4 h-4" />
        Código de Confirmação de Entrega
      </div>

      <div className="flex gap-2 md:gap-3 my-2">
        {digits.map((digito, index) => (
          <div
            key={index}
            className="w-12 h-16 md:w-14 md:h-18 bg-[#0D0D0D] border-2 border-[#F59E0B] rounded-xl flex items-center justify-center text-3xl md:text-4xl font-mono font-extrabold text-[#F59E0B] shadow-inner"
          >
            {digito}
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-300 max-w-xs font-medium leading-relaxed">
        📌 <span className="text-white font-bold">Apresente este código ao motoboy</span> no momento da entrega para liberar suas bebidas geladas.
      </p>
    </div>
  );
}
