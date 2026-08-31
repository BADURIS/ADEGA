'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { AddressCheckoutForm, AddressFormValues } from '@/components/checkout/AddressCheckoutForm';
import { PaymentSelector } from '@/components/checkout/PaymentSelector';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { useCartStore, selectCartSubtotal, selectCartTotal } from '@/store/useCartStore';
import { useHydrated } from '@/hooks/useHydrated';
import { FormaPagamento, StatusPedido } from '@/types/storefront';
import { ClienteFiadoInfo } from '@/types/checkout';
import { supabase } from '@/services/supabaseClient';

export default function CheckoutPage() {
  const router = useRouter();
  const isHydrated = useHydrated();

  const itens = useCartStore((state) => state.itens);
  const taxaEntrega = useCartStore((state) => state.taxaEntrega);
  const rawSubtotal = useCartStore(selectCartSubtotal);
  const rawTotal = useCartStore(selectCartTotal);
  const clearCart = useCartStore((state) => state.clearCart);

  const [addressData, setAddressData] = useState<AddressFormValues | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [trocoPara, setTrocoPara] = useState<number | undefined>(undefined);
  const [fiadoInfo, setFiadoInfo] = useState<ClienteFiadoInfo | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [divergentPrice, setDivergentPrice] = useState<{ novoTotal: number } | null>(null);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
      </div>
    );
  }

  const subtotal = rawSubtotal;
  const total = rawTotal;

  if (itens.length === 0) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#161616] border border-[#262626] flex items-center justify-center text-[#F59E0B] mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">Sua sacola está vazia</h1>
        <p className="text-sm text-zinc-400 max-w-sm mb-6">
          Adicione bebidas geladas ao carrinho antes de prosseguir com o checkout.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-bold text-sm rounded-xl transition"
        >
          Voltar para a Vitrine
        </Link>
      </div>
    );
  }

  const handleConfirmOrder = async (confirmarDivergencia = false) => {

    setErrorMessage(null);

    // Validação de endereço
    if (!addressData) {
      setErrorMessage('Por favor, preencha e valide o formulário de endereço acima.');
      return;
    }

    // Validação de troco em dinheiro (trocoPara deve ser estritamente maior que o total)
    if (formaPagamento === 'dinheiro' && trocoPara !== undefined && trocoPara > 0 && trocoPara <= total) {
      setErrorMessage(`O valor informado para troco entregue em dinheiro (R$ ${trocoPara.toFixed(2)}) deve ser maior que o valor total do pedido (R$ ${total.toFixed(2)}). Se não precisar de troco, deixe em branco.`);
      return;
    }


    // Validação de fiado
    if (formaPagamento === 'fiado') {
      if (!fiadoInfo) {
        setErrorMessage('Por favor, consulte seu WhatsApp cadastrado para compras no Fiado.');
        return;
      }

      if (!fiadoInfo.aprovado) {
        setErrorMessage(fiadoInfo.motivo_recusa || 'Limite de Fiado excedido.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Checagem de Rate Limiting para emissão de pedidos
      const rlRes = await fetch('/api/ratelimit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', key: addressData.cliente_whatsapp }),
      });

      const rlData = await rlRes.json().catch(() => ({ allowed: true }));
      if (!rlRes.ok || rlData.allowed === false) {
        setErrorMessage(rlData.error || 'Muitos pedidos enviados recentemente. Por favor, aguarde alguns minutos.');
        setIsSubmitting(false);
        return;
      }

      // Geração da chave de idempotência UUID v4
      const chaveIdempotencia = crypto.randomUUID();

      // 1. Chamar RPC 'criar_pedido' no Postgres (cálculo de preço 100% no servidor)
      const { data: pedido, error: rpcError } = await supabase.rpc('criar_pedido', {

        p_cliente_id: fiadoInfo?.id || null,
        p_cliente_nome: addressData.cliente_nome,
        p_cliente_whatsapp: addressData.cliente_whatsapp,
        p_endereco_rua: addressData.endereco_rua,
        p_endereco_numero: addressData.endereco_numero,
        p_endereco_bairro: addressData.bairro,
        p_endereco_complemento: addressData.endereco_complemento || null,
        p_ponto_referencia: addressData.ponto_referencia || null,
        p_forma_pagamento: formaPagamento,
        p_troco_para: formaPagamento === 'dinheiro' ? trocoPara || null : null,
        p_taxa_entrega: taxaEntrega,
        p_chave_idempotencia: chaveIdempotencia,
        p_valor_esperado: total,
        p_confirmar_divergencia: confirmarDivergencia,
        p_itens: itens.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
        })),
      });

      if (rpcError) {
        if (rpcError.message.includes('PRECO_DIVERGENTE:')) {
          const parts = rpcError.message.split('PRECO_DIVERGENTE:');
          const novoTotal = parseFloat(parts[1]);
          setDivergentPrice({ novoTotal });
          setIsSubmitting(false);
          return;
        }
        throw rpcError;
      }

      if (!pedido || !pedido.id) {
        throw new Error('Ocorreu uma falha ao gerar o pedido no servidor. Tente novamente.');
      }

      // 2. Limpar a store Zustand e redirecionar
      clearCart();
      setDivergentPrice(null);
      router.push(`/pedido/${pedido.id}`);
    } catch (err: unknown) {
      console.error('Erro ao processar pedido via RPC:', err);
      const errMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao enviar seu pedido. Tente novamente.';
      setErrorMessage(errMessage);
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white py-8 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a loja
          </Link>
          <div className="text-right">
            <h1 className="text-xl font-bold text-white">Checkout Teles Adega</h1>
            <p className="text-xs text-[#F59E0B] font-medium">Finalização Segura</p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AddressCheckoutForm
              onAddressSubmit={(values) => setAddressData(values)}
              initialValues={addressData || undefined}
            />

            <PaymentSelector
              formaPagamento={formaPagamento}
              onSelectFormaPagamento={(forma) => setFormaPagamento(forma)}
              valorTotal={total}
              trocoPara={trocoPara}
              onTrocoChange={(valor) => setTrocoPara(valor)}
              onFiadoVerified={(info) => setFiadoInfo(info)}
            />
          </div>

          <div className="space-y-6">
            <OrderSummary />

            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="w-full py-4 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-[#22C55E]/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando seu pedido...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Confirmar e Enviar Pedido
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-zinc-500">
              Ao confirmar, seu pedido será enviado para a esteira de preparo da adega.
            </p>
          </div>
        </div>
      </div>

      {divergentPrice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#262626] rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Preço Atualizado na Adega</h3>
            </div>
            <p className="text-sm text-zinc-300">
              O valor total recalculado pelo servidor é de{' '}
              <span className="font-semibold text-white">R$ {total.toFixed(2)}</span> para{' '}
              <span className="font-semibold text-[#F59E0B]">R$ {divergentPrice.novoTotal.toFixed(2)}</span>.
            </p>
            <p className="text-xs text-zinc-400">
              Houve alteração nos preços do catálogo durante a sua compra. Deseja confirmar e enviar o pedido com o valor atualizado?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDivergentPrice(null)}
                className="flex-1 py-2.5 bg-[#262626] hover:bg-[#333333] text-white text-xs font-semibold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmOrder(true)}
                className="flex-1 py-2.5 bg-[#22C55E] hover:bg-[#16a34a] text-white text-xs font-bold rounded-xl transition"
              >
                Confirmar R$ {divergentPrice.novoTotal.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

