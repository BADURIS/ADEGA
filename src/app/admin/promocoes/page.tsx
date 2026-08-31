'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Tag,
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  RefreshCw,
  Percent,
  Package,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Produto } from '@/types/storefront';
import { Promocao, DIAS_SEMANA_LABELS } from '@/types/promocoes';
import { PromotionFormModal } from '@/components/admin/promocoes/PromotionFormModal';
import { DeletePromotionModal } from '@/components/admin/promocoes/DeletePromotionModal';
import { ToastContainer, ToastMessage } from '@/components/admin/produtos/ToastNotification';

export default function AdminPromocoesPage() {
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativas' | 'agendadas' | 'inativas'>('todas');

  // Modais
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [promocaoToEdit, setPromocaoToEdit] = useState<Promocao | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [promocaoToDelete, setPromocaoToDelete] = useState<Promocao | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'warning', title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Carregar Promoções e Produtos do Supabase
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // 1. Carregar produtos ativos
      const { data: prodData, error: prodError } = await supabase
        .from('produtos')
        .select('*')
        .order('nome', { ascending: true });

      if (prodError) console.warn('Erro ao carregar produtos:', prodError);
      if (prodData) setProdutos(prodData);

      // 2. Carregar promoções com dados do produto
      const { data: promoData, error: promoError } = await supabase
        .from('promocoes')
        .select(`
          *,
          produto:produtos(*)
        `)
        .order('criado_em', { ascending: false });

      if (promoError) throw promoError;
      setPromocoes((promoData as Promocao[]) || []);
    } catch (err: unknown) {
      console.error('Erro ao carregar promoções:', err);
      const errMessage = err instanceof Error ? err.message : 'Verifique sua conexão.';
      addToast('error', 'Erro ao carregar dados', errMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper para verificar se a promoção está vigente neste exato momento
  const isPromocaoAtivaAgora = (p: Promocao) => {
    if (!p.ativo) return false;
    const now = new Date();
    const inicio = new Date(p.data_inicio);
    const fim = new Date(p.data_fim);
    const diaSemanaHoje = now.getDay(); // 0 = Dom, ..., 6 = Sab

    const dentroDoPeriodo = now >= inicio && now <= fim;
    const diaValido = p.dias_semana ? p.dias_semana.includes(diaSemanaHoje) : true;

    return dentroDoPeriodo && diaValido;
  };

  // Helper para verificar status da promoção (ativa, agendada, expirada/inativa)
  const getPromocaoStatusInfo = (p: Promocao) => {
    if (!p.ativo) {
      return { status: 'inativo', label: 'Desativada', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' };
    }
    const now = new Date();
    const inicio = new Date(p.data_inicio);
    const fim = new Date(p.data_fim);

    if (now < inicio) {
      return { status: 'agendada', label: 'Agendada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    }
    if (now > fim) {
      return { status: 'expirada', label: 'Expirada', color: 'bg-red-500/10 text-red-400 border-red-500/30' };
    }

    const diaSemanaHoje = now.getDay();
    const diaValido = p.dias_semana ? p.dias_semana.includes(diaSemanaHoje) : true;

    if (!diaValido) {
      return { status: 'dia_inativo', label: 'Pausa (Outro dia)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    }

    return { status: 'ativa', label: 'Ativa Agora', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  };

  // Métricas rápidas
  const metrics = useMemo(() => {
    const total = promocoes.length;
    const ativasHoje = promocoes.filter(isPromocaoAtivaAgora).length;

    // Calcular média de desconto
    const descontos = promocoes
      .map((p) => {
        const precoBase = p.produto ? Number(p.produto.preco) : 0;
        const precoPromo = Number(p.preco_promocional);
        if (precoBase > 0 && precoPromo < precoBase) {
          return ((precoBase - precoPromo) / precoBase) * 100;
        }
        return 0;
      })
      .filter((d) => d > 0);

    const mediaDesconto =
      descontos.length > 0
        ? Math.round(descontos.reduce((a, b) => a + b, 0) / descontos.length)
        : 0;

    return { total, ativasHoje, mediaDesconto };
  }, [promocoes]);

  // Filtragem de promoções
  const filteredPromocoes = useMemo(() => {
    return promocoes.filter((p) => {
      const nomeProd = p.produto?.nome?.toLowerCase() || '';
      const matchesSearch = nomeProd.includes(searchTerm.toLowerCase());

      const now = new Date();
      const inicio = new Date(p.data_inicio);
      const fim = new Date(p.data_fim);

      let matchesStatus = true;
      if (statusFilter === 'ativas') {
        matchesStatus = isPromocaoAtivaAgora(p);
      } else if (statusFilter === 'agendadas') {
        matchesStatus = p.ativo && now < inicio;
      } else if (statusFilter === 'inativas') {
        matchesStatus = !p.ativo || now > fim;
      }

      return matchesSearch && matchesStatus;
    });
  }, [promocoes, searchTerm, statusFilter]);

  // Toggle rápido de Ativo / Inativo com Update Otimista
  const handleToggleAtivo = async (p: Promocao, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const novoStatus = !p.ativo;

    // Update otimista
    setPromocoes((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, ativo: novoStatus } : item))
    );

    try {
      const { error } = await supabase
        .from('promocoes')
        .update({ ativo: novoStatus, atualizado_em: new Date().toISOString() })
        .eq('id', p.id);

      if (error) throw error;

      addToast(
        novoStatus ? 'success' : 'warning',
        novoStatus ? 'Promoção Ativada' : 'Promoção Pausada',
        `A promoção de ${p.produto?.nome || 'produto'} foi ${
          novoStatus ? 'ativada com sucesso' : 'pausada'
        }.`
      );
    } catch (err: unknown) {
      console.error('Erro ao alterar status da promoção:', err);
      // Reverter
      setPromocoes((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ativo: p.ativo } : item))
      );
      const errMessage = err instanceof Error ? err.message : 'Erro ao alterar status';
      addToast('error', 'Erro ao alterar status', errMessage);
    }
  };

  // Exclusão de Promoção
  const handleConfirmDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      const { error } = await supabase.from('promocoes').delete().eq('id', id);

      if (error) throw error;

      setPromocoes((prev) => prev.filter((p) => p.id !== id));
      addToast('success', 'Promoção Excluída', 'A regra promocional foi removida com sucesso.');
      setDeleteModalOpen(false);
      setPromocaoToDelete(null);
    } catch (err: unknown) {
      console.error('Erro ao deletar promoção:', err);
      const errMessage = err instanceof Error ? err.message : 'Erro ao tentar deletar promoção.';
      addToast('error', 'Falha na Exclusão', errMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Sucesso no formulário (criar ou editar)
  const handleFormSuccess = (updatedOrNew: Promocao, isEdit: boolean) => {
    if (isEdit) {
      setPromocoes((prev) =>
        prev.map((p) => (p.id === updatedOrNew.id ? updatedOrNew : p))
      );
      addToast(
        'success',
        'Promoção Atualizada',
        `Alterações salvas para ${updatedOrNew.produto?.nome || 'o produto'}.`
      );
    } else {
      setPromocoes((prev) => [updatedOrNew, ...prev]);
      addToast(
        'success',
        'Promoção Criada',
        `Promoção cadastrada para ${updatedOrNew.produto?.nome || 'o produto'}.`
      );
    }
    fetchData(true);
  };

  const formatarPreco = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatarDataHora = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Promoções Temporais & Preço Dinâmico
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Gerenciamento de ofertas temporárias, horários e dias da semana
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-3 rounded-xl bg-[#161616] border border-[#262626] text-zinc-400 hover:text-white transition shrink-0"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-[#F59E0B]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setPromocaoToEdit(null);
              setFormModalOpen(true);
            }}
            className="flex-1 md:flex-initial bg-[#F59E0B] hover:bg-[#d97706] text-black font-extrabold px-5 py-3.5 rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 text-sm transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Nova Promoção</span>
          </button>
        </div>
      </div>

      {/* 2. Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total de Promoções */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Total de Regras
            </p>
            <p className="text-2xl sm:text-3xl font-black text-white">
              {loading ? '-' : metrics.total}
            </p>
            <p className="text-[11px] text-zinc-500">Promoções cadastradas</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#F59E0B]">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        {/* Promoções Ativas Agora */}
        <div
          onClick={() => setStatusFilter((prev) => (prev === 'ativas' ? 'todas' : 'ativas'))}
          className={`bg-[#161616] border rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-md cursor-pointer transition ${
            statusFilter === 'ativas'
              ? 'border-emerald-500 ring-1 ring-emerald-500'
              : 'border-[#262626] hover:border-emerald-500/40'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Ativas no Momento
              </p>
              {metrics.ativasHoje > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black animate-pulse">
                  No Ar
                </span>
              )}
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400">
              {loading ? '-' : metrics.ativasHoje}
            </p>
            <p className="text-[11px] text-zinc-500">Aplicadas agora na vitrine</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        {/* Desconto Médio */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Média de Desconto
            </p>
            <p className="text-2xl sm:text-3xl font-black text-red-400">
              {loading ? '-' : `${metrics.mediaDesconto}%`}
            </p>
            <p className="text-[11px] text-zinc-500">Economia média oferecida</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar promoção pelo nome do produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 bg-[#161616] border border-[#262626] focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white pl-12 pr-4 rounded-2xl text-sm outline-none transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filtros de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'ativas', label: 'Ativas Agora', count: metrics.ativasHoje },
            { id: 'agendadas', label: 'Agendadas' },
            { id: 'inativas', label: 'Pausadas/Expiradas' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as 'todas' | 'ativas' | 'agendadas' | 'inativas')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                statusFilter === f.id
                  ? 'bg-[#F59E0B] text-black shadow-md'
                  : 'bg-[#161616] border border-[#262626] text-zinc-400 hover:text-white'
              }`}
            >
              <span>{f.label}</span>
              {f.count !== undefined && f.count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    statusFilter === f.id ? 'bg-black text-[#F59E0B]' : 'bg-emerald-500 text-white'
                  }`}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Listagem de Promoções */}
      {loading ? (
        <div className="bg-[#161616] border border-[#262626] rounded-3xl p-16 text-center space-y-3 shadow-xl">
          <Loader2 className="w-10 h-10 text-[#F59E0B] animate-spin mx-auto" />
          <p className="text-sm font-bold text-zinc-300">Carregando promoções cadastradas...</p>
        </div>
      ) : filteredPromocoes.length === 0 ? (
        <div className="bg-[#161616] border border-[#262626] rounded-3xl p-12 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center mx-auto text-zinc-500">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Nenhuma promoção encontrada</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Cadastre ofertas temporais para turbinar as vendas de cervejas e combos na vitrine.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPromocaoToEdit(null);
              setFormModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#F59E0B] text-black font-bold text-xs inline-flex items-center gap-1.5 hover:bg-[#d97706] transition"
          >
            <Plus className="w-4 h-4" /> Criar Primeira Promoção
          </button>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 4A. VISUALIZAÇÃO MOBILE (CARDS TOUCH-FRIENDLY) - md:hidden                 */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredPromocoes.map((p) => {
              const statusInfo = getPromocaoStatusInfo(p);
              const precoBase = p.produto ? Number(p.produto.preco) : 0;
              const precoPromo = Number(p.preco_promocional);
              const pct =
                precoBase > 0 && precoPromo < precoBase
                  ? Math.round(((precoBase - precoPromo) / precoBase) * 100)
                  : 0;

              return (
                <div
                  key={p.id}
                  className="bg-[#161616] border border-[#262626] rounded-2xl p-4 shadow-md space-y-4"
                >
                  {/* Header do Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#0D0D0D] border border-[#262626] overflow-hidden flex items-center justify-center shrink-0">
                        {p.produto?.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.produto.foto_url}
                            alt={p.produto.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-zinc-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white line-clamp-1">
                          {p.produto?.nome || 'Produto não encontrado'}
                        </h3>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500 line-through">
                            {formatarPreco(precoBase)}
                          </span>
                          <span className="text-base font-black text-[#F59E0B]">
                            {formatarPreco(precoPromo)}
                          </span>
                          {pct > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[10px] font-black">
                              -{pct}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Informações de Período e Dias */}
                  <div className="p-3 bg-[#0D0D0D] border border-[#262626] rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#F59E0B]" />
                        Período:
                      </span>
                      <span className="font-mono text-zinc-200 text-[11px]">
                        {formatarDataHora(p.data_inicio)} até {formatarDataHora(p.data_fim)}
                      </span>
                    </div>

                    {/* Dias da semana pills */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#262626]">
                      <span className="text-[11px] text-zinc-400">Dias:</span>
                      <div className="flex items-center gap-1">
                        {DIAS_SEMANA_LABELS.map((d) => {
                          const isActive = p.dias_semana?.includes(d.value);
                          return (
                            <span
                              key={d.value}
                              className={`w-6 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                isActive
                                  ? 'bg-[#F59E0B] text-black font-extrabold'
                                  : 'bg-[#161616] text-zinc-600'
                              }`}
                              title={d.label}
                            >
                              {d.short.slice(0, 1)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => handleToggleAtivo(p, e)}
                      className={`flex-1 h-11 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                        p.ativo
                          ? 'bg-[#0D0D0D] border-[#262626] text-zinc-300 hover:text-white'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {p.ativo ? (
                        <>
                          <EyeOff className="w-4 h-4 text-zinc-400" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 text-emerald-400" />
                          Ativar
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPromocaoToEdit(p);
                        setFormModalOpen(true);
                      }}
                      className="h-11 px-4 rounded-xl bg-[#0D0D0D] border border-[#262626] text-[#F59E0B] hover:bg-[#222222] font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPromocaoToDelete(p);
                        setDeleteModalOpen(true);
                      }}
                      className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition shrink-0"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* 4B. VISUALIZAÇÃO DESKTOP (TABELA MODERNA) - hidden md:block                 */}
          {/* ========================================================================= */}
          <div className="hidden md:block bg-[#161616] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-[#111111] border-b border-[#262626] text-zinc-400 uppercase text-[11px] font-black tracking-wider">
                  <tr>
                    <th className="py-4 px-5">Produto</th>
                    <th className="py-4 px-4">Preço Original</th>
                    <th className="py-4 px-4">Preço Promo</th>
                    <th className="py-4 px-4">Desconto</th>
                    <th className="py-4 px-4">Vigência Temporal</th>
                    <th className="py-4 px-4">Dias da Semana</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]">
                  {filteredPromocoes.map((p) => {
                    const statusInfo = getPromocaoStatusInfo(p);
                    const precoBase = p.produto ? Number(p.produto.preco) : 0;
                    const precoPromo = Number(p.preco_promocional);
                    const pct =
                      precoBase > 0 && precoPromo < precoBase
                        ? Math.round(((precoBase - precoPromo) / precoBase) * 100)
                        : 0;

                    return (
                      <tr key={p.id} className="hover:bg-[#1a1a1a] transition group">
                        {/* Produto */}
                        <td className="py-4 px-5 font-bold text-white">
                          <div className="flex items-center gap-3.5">
                            <div className="relative w-10 h-10 rounded-xl bg-[#0D0D0D] border border-[#262626] overflow-hidden flex items-center justify-center shrink-0">
                              {p.produto?.foto_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.produto.foto_url}
                                  alt={p.produto.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-zinc-600" />
                              )}
                            </div>
                            <span className="font-bold text-white text-sm group-hover:text-[#F59E0B] transition">
                              {p.produto?.nome || 'Produto não encontrado'}
                            </span>
                          </div>
                        </td>

                        {/* Preço Original */}
                        <td className="py-4 px-4 text-zinc-400 line-through text-xs font-semibold">
                          {formatarPreco(precoBase)}
                        </td>

                        {/* Preço Promo */}
                        <td className="py-4 px-4 font-black text-[#F59E0B] text-base">
                          {formatarPreco(precoPromo)}
                        </td>

                        {/* % Desconto */}
                        <td className="py-4 px-4">
                          {pct > 0 ? (
                            <span className="px-2.5 py-1 rounded-full bg-red-600/90 text-white text-xs font-black shadow">
                              -{pct}%
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-xs">-</span>
                          )}
                        </td>

                        {/* Vigência Temporal */}
                        <td className="py-4 px-4 text-xs font-mono text-zinc-300">
                          <div className="flex flex-col">
                            <span>De: {formatarDataHora(p.data_inicio)}</span>
                            <span className="text-zinc-500">Até: {formatarDataHora(p.data_fim)}</span>
                          </div>
                        </td>

                        {/* Dias da Semana */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1">
                            {DIAS_SEMANA_LABELS.map((d) => {
                              const isActive = p.dias_semana?.includes(d.value);
                              return (
                                <span
                                  key={d.value}
                                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                    isActive
                                      ? 'bg-[#F59E0B] text-black font-black'
                                      : 'bg-[#0D0D0D] text-zinc-600 border border-[#262626]'
                                  }`}
                                  title={d.label}
                                >
                                  {d.short.slice(0, 1)}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleToggleAtivo(p, e)}
                              className="p-2 rounded-lg bg-[#0D0D0D] border border-[#262626] hover:text-white text-zinc-400 hover:bg-[#222222] transition"
                              title={p.ativo ? 'Pausar promoção' : 'Ativar promoção'}
                            >
                              {p.ativo ? (
                                <EyeOff className="w-4 h-4 text-zinc-400" />
                              ) : (
                                <Eye className="w-4 h-4 text-emerald-400" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPromocaoToEdit(p);
                                setFormModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-[#0D0D0D] border border-[#262626] text-[#F59E0B] hover:bg-[#222222] transition"
                              title="Editar promoção"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPromocaoToDelete(p);
                                setDeleteModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
                              title="Excluir promoção"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modais */}
      <PromotionFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={handleFormSuccess}
        promocaoToEdit={promocaoToEdit}
        produtosDisponiveis={produtos}
      />

      <DeletePromotionModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        promocao={promocaoToDelete}
        isDeleting={isDeleting}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
