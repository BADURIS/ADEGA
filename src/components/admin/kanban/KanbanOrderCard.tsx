'use client';

import React, { useState } from 'react';
import { MessageCircle, Clock, CheckCircle2, XCircle, Bike, ShieldCheck, MapPin } from 'lucide-react';
import { StatusPedido } from '@/types/storefront';

export interface KanbanOrderCardProps {
  pedido: {
    id: string;
    cliente_nome: string;
    cliente_whatsapp: string;
    endereco_rua: string;
    endereco_numero: string;
    endereco_bairro: string;
    endereco_complemento?: string;
    ponto_referencia?: string;
    forma_pagamento: string;
    troco_para?: number;
    valor_produtos: number;
    taxa_entrega: number;
    valor_total: number;
    status: StatusPedido;
    codigo_entrega: string;
    criado_em: string;
    motoboy_id?: string;
    itens?: Array<{
      quantidade: number;
      produto_nome: string;
      subtotal: number;
    }>;
  };
  onAprovar?: (id: string) => void;
  onRecusar?: (id: string) => void;
  onAtribuirMotoboy?: (id: string) => void;
  onValidarCodigo?: (id: string, codigo: string) => void;
}

export function KanbanOrderCard({
  pedido,
  onAprovar,
  onRecusar,
  onAtribuirMotoboy,
  onValidarCodigo,
}: KanbanOrderCardProps) {
  const [codigoInput, setCodigoInput] = useState('');
  const [erroCodigo, setErroCodigo] = useState(false);

  const cleanWhatsapp = pedido.cliente_whatsapp.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/55${cleanWhatsapp}?text=${encodeURIComponent(
    `Olá ${pedido.cliente_nome}! Sobre o seu pedido #${pedido.id.slice(0, 6)} da Teles Adega:`
  )}`;

  const isNovoPendente =
    pedido.status === 'pendente_aprovacao' || pedido.status === 'aguardando_pagamento';

  const handleValidarCodigoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigoInput === pedido.codigo_entrega) {
      setErroCodigo(false);
      if (onValidarCodigo) onValidarCodigo(pedido.id, codigoInput);
    } else {
      setErroCodigo(true);
    }
  };

  return (
    <div
      className={`bg-[#161616] border rounded-2xl p-4 space-y-3.5 transition shadow-lg ${
        isNovoPendente
          ? 'border-[#F59E0B] shadow-[#F59E0B]/10 animate-pulse'
          : 'border-[#262626] hover:border-zinc-700'
      }`}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-white">#{pedido.id.slice(0, 6)}</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              pedido.forma_pagamento === 'pix'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : pedido.forma_pagamento === 'dinheiro'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
            }`}
          >
            {pedido.forma_pagamento}
            {pedido.troco_para ? ` (Troco p/ R$ ${pedido.troco_para})` : ''}
          </span>
        </div>

        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
          <Clock className="w-3 h-3 text-zinc-400" />
          {new Date(pedido.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Customer & Address Details */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white text-sm">{pedido.cliente_nome}</span>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 border border-[#22C55E]/30 text-[#22C55E] rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Whats
          </a>
        </div>

        <div className="flex items-start gap-1 text-zinc-400 text-[11px]">
          <MapPin className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
          <span>
            <strong className="text-zinc-200">{pedido.endereco_bairro}</strong> - {pedido.endereco_rua}, Nº{' '}
            {pedido.endereco_numero}
          </span>
        </div>
      </div>

      {/* Items list preview */}
      {pedido.itens && pedido.itens.length > 0 && (
        <div className="p-2.5 bg-[#0D0D0D] border border-[#262626] rounded-xl text-xs space-y-1 max-h-24 overflow-y-auto">
          {pedido.itens.map((item, idx) => (
            <div key={idx} className="flex justify-between text-zinc-300 text-[11px]">
              <span>
                <strong className="text-[#F59E0B]">{item.quantidade}x</strong> {item.produto_nome}
              </span>
              <span className="text-zinc-400">R$ {Number(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer Total */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#262626]">
        <span className="text-zinc-400 font-medium">Total do Pedido:</span>
        <span className="text-sm font-extrabold text-[#F59E0B]">
          R$ {Number(pedido.valor_total).toFixed(2).replace('.', ',')}
        </span>
      </div>

      {/* Contextual Action Buttons */}
      <div className="pt-2 space-y-2">
        {isNovoPendente && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAprovar && onAprovar(pedido.id)}
              className="w-full py-2 bg-[#22C55E] hover:bg-[#16a34a] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => onRecusar && onRecusar(pedido.id)}
              className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
            >
              <XCircle className="w-3.5 h-3.5" />
              Recusar
            </button>
          </div>
        )}

        {pedido.status === 'em_preparo' && (
          <button
            type="button"
            onClick={() => onAtribuirMotoboy && onAtribuirMotoboy(pedido.id)}
            className="w-full py-2 bg-[#3B82F6] hover:bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Bike className="w-4 h-4" />
            Despachar / Atribuir Motoboy
          </button>
        )}

        {pedido.status === 'em_rota' && (
          <form onSubmit={handleValidarCodigoSubmit} className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={4}
                placeholder="Código 4 dígitos"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                className="flex-1 bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-1.5 rounded-xl text-xs font-mono text-center outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-purple-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Validar
              </button>
            </div>
            {erroCodigo && (
              <p className="text-[10px] text-red-400 text-center font-semibold">
                Código incorreto! Confira com o motoboy/cliente.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
