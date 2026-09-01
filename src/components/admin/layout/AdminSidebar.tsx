'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Bike, Wallet, Package, Users, Wine, X, Sparkles, BarChart3, MapPin, Clock } from 'lucide-react';

const MENU_ITEMS = [
  {
    label: 'Kanban Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Entregas',
    href: '/admin/entregas',
    icon: Bike,
  },
  {
    label: 'Fechamento de Caixa',
    href: '/admin/entregas/caixa',
    icon: Wallet,
  },
  {
    label: 'Gestão de Produtos',
    href: '/admin/produtos',
    icon: Package,
  },
  {
    label: 'Promoções',
    href: '/admin/promocoes',
    icon: Sparkles,
  },
  {
    label: 'Clientes & Fiado',
    href: '/admin/clientes',
    icon: Users,
  },
  {
    label: 'CEPs de Entrega',
    href: '/admin/ceps',
    icon: MapPin,
  },
  {
    label: 'Horário & Loja',
    href: '/admin/horarios',
    icon: Clock,
  },
  {
    label: 'Relatórios',
    href: '/admin/relatorios',
    icon: BarChart3,
  },
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const SidebarContent = () => (
    <div className="flex flex-col justify-between h-full overflow-y-auto">
      <div className="p-5 space-y-6">
        {/* Branding Logo & Close Button for Mobile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Wine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base leading-tight">TELES ADEGA</h2>
              <span className="text-[10px] font-bold text-[#F59E0B] tracking-wider uppercase">
                Admin Control
              </span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg bg-[#0D0D0D] border border-[#262626] md:hidden"
              title="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {MENU_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin/dashboard' &&
               item.href !== '/admin/entregas' &&
               pathname.startsWith(item.href + '/'));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#F59E0B] text-[#0D0D0D] shadow-lg shadow-[#F59E0B]/10'
                    : 'text-zinc-400 hover:text-white hover:bg-[#222222]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-[#262626] text-center">
        <p className="text-[11px] text-zinc-500">Teles Adega v1.0.0</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-[#161616] border-r border-[#262626] flex flex-col justify-between hidden md:flex shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer / Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Container */}
          <div className="relative w-72 max-w-[80vw] bg-[#161616] border-r border-[#262626] h-full z-10 shadow-2xl flex flex-col">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
