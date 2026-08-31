'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Percent,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Produto } from '@/types/storefront';
import { Promocao, PromocaoFormData, DIAS_SEMANA_LABELS } from '@/types/promocoes';

interface PromotionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (promocao: Promocao, isEdit: boolean) => void;
  promocaoToEdit?: Promocao | null;
  produtosDisponiveis?: Produto[];
}

export function PromotionFormModal({
  isOpen,
  onClose,
  onSuccess,
  promocaoToEdit,
  produtosDisponiveis = [],
}: PromotionFormModalProps) {
  const isEdit = Boolean(promocaoToEdit);

  // Lista de produtos caso não seja passada via props
  const [produtos, setProdutos] = useState<Produto[]>(produtosDisponiveis);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  // Form State
  const [formData, setFormData] = useState<PromocaoFormData>({
    produto_id: '',
    preco_promocional: '',
    data_inicio: '',
    data_fim: '',
    dias_semana: [0, 1, 2, 3, 4, 5, 6],
    ativo: true,
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Helper para formatar ISO em YYYY-MM-DDTHH:mm para o input datetime-local
  const formatDatetimeForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  // Carregar produtos se necessário
  useEffect(() => {
    if (produtosDisponiveis.length > 0) {
      setProdutos(produtosDisponiveis);
    } else if (isOpen) {
      const loadProds = async () => {
        setLoadingProdutos(true);
        try {
          const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true });
          if (!error && data) {
            setProdutos(data);
          }
        } catch (err) {
          console.error('Erro ao carregar produtos para promoção:', err);
        } finally {
          setLoadingProdutos(false);
        }
      };
      loadProds();
    }
  }, [isOpen, produtosDisponiveis]);

  // Inicializar formulário
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      if (promocaoToEdit) {
        setFormData({
          produto_id: promocaoToEdit.produto_id,
          preco_promocional: promocaoToEdit.preco_promocional,
          data_inicio: formatDatetimeForInput(promocaoToEdit.data_inicio),
          data_fim: formatDatetimeForInput(promocaoToEdit.data_fim),
          dias_semana: promocaoToEdit.dias_semana || [0, 1, 2, 3, 4, 5, 6],
          ativo: promocaoToEdit.ativo ?? true,
        });
      } else {
        // Padrão: início agora, fim daqui a 7 dias
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const pad = (n: number) => n.toString().padStart(2, '0');

        const nowFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
          now.getDate()
        )}T00:00`;
        const endFormatted = `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(
          nextWeek.getDate()
        )}T23:59`;

        setFormData({
          produto_id: produtos.length > 0 ? produtos[0].id : '',
          preco_promocional: '',
          data_inicio: nowFormatted,
          data_fim: endFormatted,
          dias_semana: [0, 1, 2, 3, 4, 5, 6],
          ativo: true,
        });
      }
    }
  }, [isOpen, promocaoToEdit, produtos]);

  if (!isOpen) return null;

  // Produto selecionado atual
  const selectedProduct = produtos.find((p) => p.id === formData.produto_id);
  const precoOriginal = selectedProduct ? Number(selectedProduct.preco) : 0;
  const precoPromoNum =
    typeof formData.preco_promocional === 'number'
      ? formData.preco_promocional
      : parseFloat(String(formData.preco_promocional || '0').replace(',', '.'));

  // Cálculo do percentual de desconto
  const percentualDesconto =
    precoOriginal > 0 && precoPromoNum > 0 && precoPromoNum < precoOriginal
      ? Math.round(((precoOriginal - precoPromoNum) / precoOriginal) * 100)
      : 0;

  // Toggle de dias da semana
  const toggleDiaSemana = (dia: number) => {
    setFormData((prev) => {
      const exists = prev.dias_semana.includes(dia);
      if (exists) {
        // Não permitir remover todos os dias
        if (prev.dias_semana.length === 1) return prev;
        return { ...prev, dias_semana: prev.dias_semana.filter((d) => d !== dia) };
      } else {
        return {
          ...prev,
          dias_semana: [...prev.dias_semana, dia].sort((a, b) => a - b),
        };
      }
    });
  };

  // Atalhos de dias da semana
  const setQuickDias = (tipo: 'todos' | 'fim-de-semana' | 'dias-uteis') => {
    if (tipo === 'todos') {
      setFormData((prev) => ({ ...prev, dias_semana: [0, 1, 2, 3, 4, 5, 6] }));
    } else if (tipo === 'fim-de-semana') {
      setFormData((prev) => ({ ...prev, dias_semana: [5, 6, 0] })); // Sex, Sáb, Dom
    } else if (tipo === 'dias-uteis') {
      setFormData((prev) => ({ ...prev, dias_semana: [1, 2, 3, 4, 5] })); // Seg a Sex
    }
  };

  // Validação
  const validate = () => {
    const errs: { [key: string]: string } = {};

    if (!formData.produto_id) {
      errs.produto_id = 'Selecione um produto para a promoção.';
    }

    if (!formData.preco_promocional || precoPromoNum <= 0) {
      errs.preco_promocional = 'Informe um preço promocional válido maior que zero.';
    } else if (precoOriginal > 0 && precoPromoNum >= precoOriginal) {
      errs.preco_promocional = `O preço promocional (R$ ${precoPromoNum.toFixed(
        2
      )}) deve ser estritamente menor que o preço original (R$ ${precoOriginal.toFixed(2)}).`;
    }

    if (!formData.data_inicio) {
      errs.data_inicio = 'Informe a data e horário de início.';
    }

    if (!formData.data_fim) {
      errs.data_fim = 'Informe a data e horário de término.';
    } else if (
      formData.data_inicio &&
      new Date(formData.data_fim) <= new Date(formData.data_inicio)
    ) {
      errs.data_fim = 'A data de término deve ser posterior à data de início.';
    }

    if (!formData.dias_semana || formData.dias_semana.length === 0) {
      errs.dias_semana = 'Selecione pelo menos um dia da semana para vigência.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        produto_id: formData.produto_id,
        preco_promocional: precoPromoNum,
        data_inicio: new Date(formData.data_inicio).toISOString(),
        data_fim: new Date(formData.data_fim).toISOString(),
        dias_semana: formData.dias_semana,
        ativo: formData.ativo,
        atualizado_em: new Date().toISOString(),
      };

      if (isEdit && promocaoToEdit) {
        const { data, error } = await supabase
          .from('promocoes')
          .update(payload)
          .eq('id', promocaoToEdit.id)
          .select(`*, produto:produtos(*)`)
          .single();

        if (error) throw error;
        onSuccess(data as Promocao, true);
      } else {
        const { data, error } = await supabase
          .from('promocoes')
          .insert(payload)
          .select(`*, produto:produtos(*)`)
          .single();

        if (error) throw error;
        onSuccess(data as Promocao, false);
      }

      onClose();
    } catch (err: unknown) {
      console.error('Erro ao salvar promoção:', err);
      const errMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao salvar a promoção no banco.';
      setErrors((prev) => ({
        ...prev,
        submit: errMessage,
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#161616] border border-[#262626] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] p-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                {isEdit ? 'Editar Promoção Temporal' : 'Nova Promoção Temporal'}
              </h2>
              <p className="text-xs text-zinc-400">
                Configure descontos automáticos por período e dias da semana
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl bg-[#0D0D0D] border border-[#262626] transition"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errors.submit && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errors.submit}</span>
            </div>
          )}

          {/* 1. Seleção de Produto */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Produto</span>
              {selectedProduct && (
                <span className="text-xs font-semibold text-zinc-400 normal-case">
                  Preço Original:{' '}
                  <strong className="text-white">
                    R$ {precoOriginal.toFixed(2).replace('.', ',')}
                  </strong>
                </span>
              )}
            </label>

            {loadingProdutos ? (
              <div className="h-12 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center px-4 text-xs text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-[#F59E0B]" />
                Carregando lista de produtos...
              </div>
            ) : (
              <select
                value={formData.produto_id}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, produto_id: e.target.value }));
                  if (errors.produto_id) setErrors((prev) => ({ ...prev, produto_id: '' }));
                }}
                disabled={isEdit}
                className={`w-full h-12 bg-[#0D0D0D] border ${
                  errors.produto_id ? 'border-red-500' : 'border-[#262626]'
                } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white px-4 rounded-xl text-sm outline-none transition disabled:opacity-60`}
              >
                <option value="" disabled>
                  Selecione um produto...
                </option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                  </option>
                ))}
              </select>
            )}
            {errors.produto_id && (
              <p className="text-[11px] text-red-400">{errors.produto_id}</p>
            )}
          </div>

          {/* 2. Preço Promocional e Preview de Desconto */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Preço Promocional (R$)</span>
              {percentualDesconto > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black">
                  <Percent className="w-3 h-3" />
                  {percentualDesconto}% de Desconto
                </span>
              )}
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 7.90"
                value={formData.preco_promocional}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                  setFormData((prev) => ({ ...prev, preco_promocional: val }));
                  if (errors.preco_promocional) {
                    setErrors((prev) => ({ ...prev, preco_promocional: '' }));
                  }
                }}
                className={`w-full h-12 bg-[#0D0D0D] border ${
                  errors.preco_promocional ? 'border-red-500' : 'border-[#262626]'
                } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white pl-12 pr-4 rounded-xl text-base font-bold outline-none transition`}
              />
            </div>
            {errors.preco_promocional && (
              <p className="text-[11px] text-red-400">{errors.preco_promocional}</p>
            )}
          </div>

          {/* 3. Datas de Início e Fim */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Início da Promoção</span>
              </label>
              <input
                type="datetime-local"
                value={formData.data_inicio}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, data_inicio: e.target.value }));
                  if (errors.data_inicio) setErrors((prev) => ({ ...prev, data_inicio: '' }));
                }}
                className={`w-full h-12 bg-[#0D0D0D] border ${
                  errors.data_inicio ? 'border-red-500' : 'border-[#262626]'
                } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white px-3.5 rounded-xl text-xs sm:text-sm outline-none transition color-scheme-dark`}
              />
              {errors.data_inicio && (
                <p className="text-[11px] text-red-400">{errors.data_inicio}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Término da Promoção</span>
              </label>
              <input
                type="datetime-local"
                value={formData.data_fim}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, data_fim: e.target.value }));
                  if (errors.data_fim) setErrors((prev) => ({ ...prev, data_fim: '' }));
                }}
                className={`w-full h-12 bg-[#0D0D0D] border ${
                  errors.data_fim ? 'border-red-500' : 'border-[#262626]'
                } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white px-3.5 rounded-xl text-xs sm:text-sm outline-none transition color-scheme-dark`}
              />
              {errors.data_fim && (
                <p className="text-[11px] text-red-400">{errors.data_fim}</p>
              )}
            </div>
          </div>

          {/* 4. Seletor de Dias da Semana */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Dias de Vigência na Semana
              </label>
              {/* Atalhos Rápidos */}
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setQuickDias('todos')}
                  className="px-2 py-0.5 rounded-md bg-[#0D0D0D] text-zinc-400 hover:text-white border border-[#262626] transition"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDias('fim-de-semana')}
                  className="px-2 py-0.5 rounded-md bg-[#0D0D0D] text-zinc-400 hover:text-white border border-[#262626] transition"
                >
                  Sex-Dom
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDias('dias-uteis')}
                  className="px-2 py-0.5 rounded-md bg-[#0D0D0D] text-zinc-400 hover:text-white border border-[#262626] transition"
                >
                  Seg-Sex
                </button>
              </div>
            </div>

            {/* Grid com os 7 dias da semana */}
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS_SEMANA_LABELS.map((d) => {
                const isSelected = formData.dias_semana.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDiaSemana(d.value)}
                    className={`h-11 rounded-xl flex flex-col items-center justify-center font-bold transition text-xs ${
                      isSelected
                        ? 'bg-[#F59E0B] text-black shadow-md shadow-amber-500/10 font-extrabold'
                        : 'bg-[#0D0D0D] text-zinc-500 border border-[#262626] hover:text-zinc-300'
                    }`}
                    title={d.label}
                  >
                    <span>{d.short}</span>
                  </button>
                );
              })}
            </div>
            {errors.dias_semana && (
              <p className="text-[11px] text-red-400">{errors.dias_semana}</p>
            )}
          </div>

          {/* 5. Toggle Ativo / Inativo */}
          <div className="pt-2 border-t border-[#262626] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">Status da Promoção</p>
              <p className="text-[11px] text-zinc-400">
                {formData.ativo
                  ? 'A promoção será aplicada automaticamente nas datas e dias definidos.'
                  : 'A promoção está pausada e não será exibida na vitrine.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, ativo: !prev.ativo }))}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                formData.ativo ? 'bg-[#F59E0B]' : 'bg-[#262626]'
              }`}
              role="switch"
              aria-checked={formData.ativo}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  formData.ativo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-3 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-300 hover:text-white font-bold text-xs transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-black font-extrabold text-xs shadow-lg shadow-amber-500/10 flex items-center gap-2 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEdit ? 'Salvar Alterações' : 'Criar Promoção'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
