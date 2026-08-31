import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { StatusPedido } from '@/types/storefront';

export interface OrderRealtimeData {
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
  taxa_entrega: number;
  valor_produtos: number;
  valor_total: number;
  status: StatusPedido;
  codigo_entrega: string;
  chave_idempotencia: string;
  motoboy_id?: string | null;
  motoboy?: {
    id: string;
    nome: string;
    telefone: string;
    latitude?: number | null;
    longitude?: number | null;
    ultima_localizacao_em?: string | null;
  } | null;
  criado_em: string;
  atualizado_em?: string;
}

export function useOrderRealtime(pedidoId: string, initialData: OrderRealtimeData | null) {
  const [pedido, setPedido] = useState<OrderRealtimeData | null>(initialData);

  useEffect(() => {
    if (initialData) {
      setPedido(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (!pedidoId) return;

    const channel = supabase
      .channel(`order-status-${pedidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `id=eq.${pedidoId}`,
        },
        (payload) => {
          const novoPedido = payload.new as OrderRealtimeData;
          setPedido(novoPedido);

          if (novoPedido.status === 'em_rota' && typeof window !== 'undefined') {
            try {
              const audio = new Audio('/sounds/notification.mp3');
              audio.play().catch(() => {});
            } catch {
              // Ignore audio play errors
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId]);

  return { pedido };
}
