import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Adega Teles - Delivery',
  description: 'Sistema de Delivery da Adega Teles',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-[#0D0D0D] text-white">
        {children}
      </body>
    </html>
  );
}
