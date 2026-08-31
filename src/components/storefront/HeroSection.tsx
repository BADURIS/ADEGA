'use client';

import React from 'react';
import { Zap, Snowflake, ShieldCheck, PhoneCall, ChevronDown } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const handleScrollToCategories = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const targetElement = document.getElementById('categorias');
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-[#0D0D0D] border-b border-[#262626] py-12 sm:py-16 lg:py-20">
      {/* Elementos visuais de iluminação em background (Glow Effects) */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#F59E0B]/10 blur-3xl sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#22C55E]/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge promocional superior */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#F59E0B]/30 bg-[#161616] px-3.5 py-1.5 text-xs font-semibold text-[#F59E0B] shadow-inner mb-6">
          <Zap className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
          <span>Delivery Oficial na Baixada Santista (13)</span>
        </div>

        {/* Título Principal & Slogans */}
        <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-5xl lg:text-6xl max-w-4xl mx-auto leading-tight sm:leading-none">
          Gelada na sua porta em{' '}
          <span className="bg-gradient-to-r from-[#F59E0B] via-amber-400 to-[#D97706] bg-clip-text text-transparent drop-shadow-sm">
            minutos!
          </span>
        </h1>

        <p className="mt-4 text-base font-normal text-zinc-400 sm:text-xl max-w-2xl mx-auto">
          Rápido, Gelado, Confiável. O catálogo completo de cervejas, destilados e combos com entrega expressa.
        </p>

        {/* Botão de Ação CTA */}
        <div className="mt-8 flex justify-center">
          <a
            href="#categorias"
            onClick={handleScrollToCategories}
            className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] px-7 py-4 text-base font-extrabold text-[#0D0D0D] shadow-xl shadow-[#F59E0B]/25 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#F59E0B]/40"
          >
            <span>Ver Bebidas Geladas</span>
            <ChevronDown className="h-5 w-5 stroke-[3] transition-transform group-hover:translate-y-1" />
          </a>
        </div>

        {/* Selos Oficiais da Adega */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#161616]/80 p-3.5 backdrop-blur-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/10 text-[#F59E0B]">
              <Zap className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white">Entrega Rápida</p>
              <p className="text-[11px] text-zinc-400">Na sua porta no grau</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#161616]/80 p-3.5 backdrop-blur-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Snowflake className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white">Bebidas Trincando</p>
              <p className="text-[11px] text-zinc-400">Temperatura ideal</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#161616]/80 p-3.5 backdrop-blur-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white">Compra Segura</p>
              <p className="text-[11px] text-zinc-400">Pix, Dinheiro ou Fiado</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#161616]/80 p-3.5 backdrop-blur-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#22C55E]/10 text-[#22C55E]">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white">Atendimento Wpp</p>
              <p className="text-[11px] text-zinc-400">Suporte direto (13)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
