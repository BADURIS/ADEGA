'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { buscarCep } from '@/services/viaCep';
import { useCartStore } from '@/store/useCartStore';

const addressSchema = z.object({
  cliente_nome: z.string().min(3, 'Nome completo deve ter pelo menos 3 caracteres'),
  cliente_whatsapp: z
    .string()
    .min(10, 'WhatsApp deve conter DDD + Número (mínimo 10 dígitos)')
    .regex(/^[\d\s()+-]+$/, 'Formato de telefone/WhatsApp inválido'),
  cep: z
    .string()
    .min(8, 'CEP deve ter 8 dígitos')
    .transform((val) => val.replace(/\D/g, '')),
  endereco_rua: z.string().min(3, 'Rua/Logradouro é obrigatório'),
  endereco_numero: z.string().min(1, 'Número é obrigatório'),
  bairro: z.string().min(2, 'Bairro é obrigatório'),
  endereco_complemento: z.string().optional(),
  ponto_referencia: z.string().optional(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

interface AddressCheckoutFormProps {
  onAddressSubmit: (data: AddressFormValues) => void;
  initialValues?: Partial<AddressFormValues>;
}

export function AddressCheckoutForm({ onAddressSubmit, initialValues }: AddressCheckoutFormProps) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepStatus, setCepStatus] = useState<{
    tipo: 'sucesso' | 'aviso' | 'erro' | null;
    mensagem: string;
  }>({ tipo: null, mensagem: '' });

  const setDeliveryZone = useCartStore((state) => state.setDeliveryZone);
  const taxaEntrega = useCartStore((state) => state.taxaEntrega);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      cliente_nome: initialValues?.cliente_nome || '',
      cliente_whatsapp: initialValues?.cliente_whatsapp || '',
      cep: initialValues?.cep || '',
      endereco_rua: initialValues?.endereco_rua || '',
      endereco_numero: initialValues?.endereco_numero || '',
      bairro: initialValues?.bairro || '',
      endereco_complemento: initialValues?.endereco_complemento || '',
      ponto_referencia: initialValues?.ponto_referencia || '',
    },
  });

  const cepValue = watch('cep');

  const formatCepDisplay = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 8);
    if (cleaned.length > 5) {
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    return cleaned;
  };

  const handleCepSearch = async (rawCep: string) => {
    const cleaned = rawCep.replace(/\D/g, '');
    if (cleaned.length !== 8) return;

    setLoadingCep(true);
    setCepStatus({ tipo: null, mensagem: '' });

    const result = await buscarCep(cleaned);

    setLoadingCep(false);

    if (!result.sucesso) {
      setCepStatus({
        tipo: 'erro',
        mensagem: result.mensagemErro || 'Erro ao consultar CEP.',
      });
      return;
    }

    if (result.logradouro) setValue('endereco_rua', result.logradouro, { shouldValidate: true });
    if (result.bairro) setValue('bairro', result.bairro, { shouldValidate: true });

    if (result.bairroEncontrado) {
      setDeliveryZone(result.bairro, result.taxaEntrega);
      setCepStatus({
        tipo: 'sucesso',
        mensagem: `Bairro ${result.bairro} atendido! Taxa de entrega: R$ ${result.taxaEntrega.toFixed(2).replace('.', ',')}`,
      });
    } else {
      setDeliveryZone(result.bairro, 10.0); // Valor padrão
      setCepStatus({
        tipo: 'aviso',
        mensagem: result.mensagemErro || 'Bairro fora da tabela padrão. Frete estimado: R$ 10,00',
      });
    }
  };

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
      <div className="flex items-center gap-3 border-b border-[#262626] pb-4">
        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">1. Endereço e Identificação</h2>
          <p className="text-xs text-zinc-400">Informe para onde levaremos suas bebidas geladas</p>
        </div>
      </div>

      <form id="address-form" onSubmit={handleSubmit(onAddressSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Nome Completo <span className="text-[#F59E0B]">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: João da Silva"
              {...register('cliente_nome')}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
            />
            {errors.cliente_nome && (
              <p className="text-xs text-red-400 mt-1">{errors.cliente_nome.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              WhatsApp (DDD + Número) <span className="text-[#F59E0B]">*</span>
            </label>
            <input
              type="tel"
              placeholder="Ex: (13) 99765-0605"
              {...register('cliente_whatsapp')}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
            />
            {errors.cliente_whatsapp && (
              <p className="text-xs text-red-400 mt-1">{errors.cliente_whatsapp.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            CEP <span className="text-[#F59E0B]">*</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="11000-000"
              maxLength={9}
              value={formatCepDisplay(cepValue || '')}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '');
                setValue('cep', cleaned);
                if (cleaned.length === 8) {
                  handleCepSearch(cleaned);
                }
              }}
              onBlur={() => {
                if (cepValue && cepValue.length === 8) {
                  handleCepSearch(cepValue);
                }
              }}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white pl-4 pr-12 py-2.5 rounded-xl text-sm outline-none transition"
            />
            <button
              type="button"
              onClick={() => cepValue && handleCepSearch(cepValue)}
              disabled={loadingCep}
              className="absolute right-2 px-3 py-1.5 bg-[#222] hover:bg-[#333] text-zinc-300 rounded-lg text-xs flex items-center gap-1 transition"
            >
              {loadingCep ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
              ) : (
                <Search className="w-4 h-4 text-[#F59E0B]" />
              )}
            </button>
          </div>
          {errors.cep && <p className="text-xs text-red-400 mt-1">{errors.cep.message}</p>}

          {cepStatus.tipo && (
            <div
              className={`mt-2 p-3 rounded-xl text-xs flex items-start gap-2 ${
                cepStatus.tipo === 'sucesso'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : cepStatus.tipo === 'aviso'
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {cepStatus.tipo === 'sucesso' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{cepStatus.mensagem}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Rua / Logradouro <span className="text-[#F59E0B]">*</span>
            </label>
            <input
              type="text"
              placeholder="Rua, Avenida, Praça..."
              {...register('endereco_rua')}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
            />
            {errors.endereco_rua && (
              <p className="text-xs text-red-400 mt-1">{errors.endereco_rua.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Número <span className="text-[#F59E0B]">*</span>
            </label>
            <input
              type="text"
              placeholder="123"
              {...register('endereco_numero')}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
            />
            {errors.endereco_numero && (
              <p className="text-xs text-red-400 mt-1">{errors.endereco_numero.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Bairro <span className="text-[#F59E0B]">*</span>
            </label>
            <input
              type="text"
              placeholder="Bairro"
              {...register('bairro')}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
            />
            {errors.bairro && (
              <p className="text-xs text-red-400 mt-1">{errors.bairro.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Complemento</label>
            <input
              type="text"
              placeholder="Apto 42, Bloco B, Casa dos Fundo"
              {...register('endereco_complemento')}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Ponto de Referência
          </label>
          <input
            type="text"
            placeholder="Próximo à padaria X, em frente à praça Y..."
            {...register('ponto_referencia')}
            className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
          />
        </div>

        {taxaEntrega > 0 && (
          <div className="p-3 bg-[#0D0D0D] border border-[#262626] rounded-xl flex items-center justify-between">
            <span className="text-xs text-zinc-400">Taxa de Entrega Calculada:</span>
            <span className="text-sm font-bold text-[#F59E0B]">
              R$ {taxaEntrega.toFixed(2).replace('.', ',')}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
