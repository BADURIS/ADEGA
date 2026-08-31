'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Volume2, VolumeX, Wifi, Menu, Globe, ExternalLink } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';

interface AdminHeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  isConnected?: boolean;
  onOpenMobileMenu?: () => void;
}

export function AdminHeader({
  soundEnabled,
  onToggleSound,
  isConnected = true,
  onOpenMobileMenu,
}: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <header className="h-16 bg-[#161616] border-b border-[#262626] px-4 md:px-6 flex items-center justify-between shrink-0">
      {/* Left side: Hamburger + Realtime Status */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-2 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-400 hover:text-white transition md:hidden"
          title="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Realtime WebSocket Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isConnected ? 'Realtime Conectado' : 'Reconectando...'}</span>
          <span className="sm:hidden">{isConnected ? 'On' : 'Off'}</span>
        </div>
      </div>

      {/* Right side: Store Button + Sound Toggle + Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Storefront Link Button */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-xl bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-bold flex items-center gap-1.5 transition"
          title="Abrir Loja / E-commerce em nova aba"
        >
          <Globe className="w-4 h-4 text-[#F59E0B]" />
          <span className="hidden sm:inline">Ver Loja / E-commerce</span>
          <span className="sm:hidden">Loja</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </a>

        {/* Sound Alert Toggle Button */}
        <button
          type="button"
          onClick={onToggleSound}
          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
            soundEnabled
              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]'
              : 'bg-[#0D0D0D] border-[#262626] text-zinc-500 hover:text-white'
          }`}
          title={soundEnabled ? 'Alerta Sonoro Ativo' : 'Alerta Sonoro Mudo'}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-4 h-4 text-[#F59E0B] animate-pulse" />
              <span className="hidden sm:inline">Sons Ativos</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4" />
              <span className="hidden sm:inline">Sons Mutos</span>
            </>
          )}
        </button>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition flex items-center gap-2 text-xs font-semibold"
          title="Sair da Conta"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
