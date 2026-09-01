'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Bike, Package, Users, MapPin, Clock } from 'lucide-react';

const NAV_ITEMS = [
  {
    label: 'Kanban',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Entregas',
    href: '/admin/entregas',
    icon: Bike,
  },
  {
    label: 'Produtos',
    href: '/admin/produtos',
    icon: Package,
  },
  {
    label: 'Clientes',
    href: '/admin/clientes',
    icon: Users,
  },
  {
    label: 'CEPs',
    href: '/admin/ceps',
    icon: MapPin,
  },
  {
    label: 'Horário',
    href: '/admin/horarios',
    icon: Clock,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#161616] border-t border-[#262626] md:hidden px-2 py-1.5 flex items-center justify-around">
      {NAV_ITEMS.map((item) => {
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
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
              isActive
                ? 'text-[#F59E0B] font-bold bg-[#F59E0B]/10'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
