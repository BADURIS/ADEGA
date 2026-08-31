import { useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Pedido } from '@/types/storefront';

export function useRealtimeOrders(
  onNewOrder: (order: Pedido) => void,
  onUpdateOrder: (order: Pedido) => void
) {
  useEffect(() => {
    const channel = supabase
      .channel('admin-kanban-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos',
        },
        (payload) => {
          if (payload.new) {
            onNewOrder(payload.new as unknown as Pedido);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
        },
        (payload) => {
          if (payload.new) {
            onUpdateOrder(payload.new as unknown as Pedido);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewOrder, onUpdateOrder]);
}
