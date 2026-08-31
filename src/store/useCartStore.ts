import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartStoreState, Produto } from '@/types/storefront';

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      itens: [],
      taxaEntrega: 0,
      bairroSelecionado: null,

      addItem: (produto: Produto, quantidade = 1) => {
        const { itens } = get();
        const itemExistente = itens.find((i) => i.produto.id === produto.id);
        const precoUnitarioVigente = Number(produto.preco_vigente ?? produto.preco);

        if (itemExistente) {
          const novaQtd = Math.min(
            itemExistente.quantidade + quantidade,
            produto.estoque_atual
          );
          set({
            itens: itens.map((i) =>
              i.produto.id === produto.id
                ? {
                    ...i,
                    produto,
                    precoUnitario: precoUnitarioVigente,
                    promocao_id: produto.promocao_id || null,
                    quantidade: novaQtd,
                    subtotal: novaQtd * precoUnitarioVigente,
                  }
                : i
            ),
          });
        } else {
          const qtdInicial = Math.min(quantidade, produto.estoque_atual);
          if (qtdInicial <= 0) return;

          set({
            itens: [
              ...itens,
              {
                produto,
                quantidade: qtdInicial,
                precoUnitario: precoUnitarioVigente,
                subtotal: qtdInicial * precoUnitarioVigente,
                promocao_id: produto.promocao_id || null,
              },
            ],
          });
        }
      },

      removeItem: (produtoId: string) => {
        set({
          itens: get().itens.filter((i) => i.produto.id !== produtoId),
        });
      },

      updateQuantity: (produtoId: string, quantidade: number) => {
        if (quantidade <= 0) {
          get().removeItem(produtoId);
          return;
        }

        set({
          itens: get().itens.map((i) => {
            if (i.produto.id === produtoId) {
              const novaQtd = Math.min(quantidade, i.produto.estoque_atual);
              return {
                ...i,
                quantidade: novaQtd,
                subtotal: novaQtd * i.precoUnitario,
              };
            }
            return i;
          }),
        });
      },

      clearCart: () => {
        set({ itens: [], taxaEntrega: 0, bairroSelecionado: null });
      },

      setDeliveryZone: (bairro: string, taxa: number) => {
        set({ bairroSelecionado: bairro, taxaEntrega: taxa });
      },

      getSubtotal: () => {
        return get().itens.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0);
      },

      getTotal: () => {
        return get().getSubtotal() + (Number(get().taxaEntrega) || 0);
      },

      getItemCount: () => {
        return get().itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
      },
    }),
    {
      name: 'teles_adega_cart_v1',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : ({} as Storage))),
      partialize: (state) => ({
        itens: state.itens,
        taxaEntrega: state.taxaEntrega,
        bairroSelecionado: state.bairroSelecionado,
      }),
    }
  )
);

// Seletores Reativos (sempre disparam re-render quando itens ou taxa mudam)
export const selectCartItemCount = (state: CartStoreState) =>
  state.itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);

export const selectCartSubtotal = (state: CartStoreState) =>
  state.itens.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0);

export const selectCartTotal = (state: CartStoreState) =>
  state.itens.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0) + (Number(state.taxaEntrega) || 0);

