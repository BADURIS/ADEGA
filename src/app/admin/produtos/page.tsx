'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Boxes,
  Minus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Categoria, Produto } from '@/types/storefront';
import { ProductFormModal } from '@/components/admin/produtos/ProductFormModal';
import { DeleteConfirmModal } from '@/components/admin/produtos/DeleteConfirmModal';
import { ToastContainer, ToastMessage } from '@/components/admin/produtos/ToastNotification';

export default function AdminProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('todas');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'todos' | 'critico' | 'ativo' | 'inativo'>('todos');

  // Modais
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Produto | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Produto | null>(null);
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

  // Carregar Categorias e Produtos do Supabase
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // Buscar categorias
      const { data: catData, error: catError } = await supabase
        .from('categorias')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (catError) console.warn('Erro ao carregar categorias:', catError);
      if (catData) setCategorias(catData);

      // Buscar produtos com join na categoria
      const { data: prodData, error: prodError } = await supabase
        .from('produtos')
        .select(`
          *,
          categoria:categorias(nome)
        `)
        .order('nome', { ascending: true });

      if (prodError) throw prodError;
      setProdutos(prodData || []);
    } catch (err: unknown) {
      console.error('Erro ao carregar produtos:', err);
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

  // Cálculos de Métricas Rápidas
  const metrics = useMemo(() => {
    const total = produtos.length;
    const critico = produtos.filter((p) => p.estoque_atual <= p.estoque_minimo).length;
    const ativos = produtos.filter((p) => p.ativo).length;
    return { total, critico, ativos };
  }, [produtos]);

  // Filtragem de Produtos
  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      const matchesSearch =
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.descricao && p.descricao.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategoriaId === 'todas' || p.categoria_id === selectedCategoriaId;

      let matchesStatus = true;
      if (selectedStatusFilter === 'critico') {
        matchesStatus = p.estoque_atual <= p.estoque_minimo;
      } else if (selectedStatusFilter === 'ativo') {
        matchesStatus = p.ativo === true;
      } else if (selectedStatusFilter === 'inativo') {
        matchesStatus = p.ativo === false;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [produtos, searchTerm, selectedCategoriaId, selectedStatusFilter]);

  // Contagem por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: produtos.length };
    produtos.forEach((p) => {
      counts[p.categoria_id] = (counts[p.categoria_id] || 0) + 1;
    });
    return counts;
  }, [produtos]);

  // Handlers para Ações de Produtos
  const handleOpenCreateModal = () => {
    setProductToEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (p: Produto) => {
    setProductToEdit(p);
    setFormModalOpen(true);
  };

  const handleOpenDeleteModal = (p: Produto) => {
    setProductToDelete(p);
    setDeleteModalOpen(true);
  };

  // Sucesso no Form Modal (Create ou Edit)
  const handleFormSuccess = (updatedOrNewProduct: Produto, isEdit: boolean) => {
    if (isEdit) {
      setProdutos((prev) =>
        prev.map((p) => (p.id === updatedOrNewProduct.id ? updatedOrNewProduct : p))
      );
      addToast('success', 'Produto Atualizado', `${updatedOrNewProduct.nome} foi atualizado com sucesso.`);
    } else {
      setProdutos((prev) => [updatedOrNewProduct, ...prev]);
      addToast('success', 'Produto Criado', `${updatedOrNewProduct.nome} cadastrado com sucesso.`);
    }
    fetchData(true);
  };

  // Ajuste Rápido de Estoque (+ ou -) com Update Otimista
  const handleAdjustEstoque = async (id: string, delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const targetProd = produtos.find((p) => p.id === id);
    if (!targetProd) return;

    const novoEstoque = Math.max(0, targetProd.estoque_atual + delta);
    if (novoEstoque === targetProd.estoque_atual) return;

    // Atualização Otimista local
    setProdutos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estoque_atual: novoEstoque } : p))
    );

    try {
      const { error } = await supabase
        .from('produtos')
        .update({
          estoque_atual: novoEstoque,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      addToast('success', 'Estoque Atualizado', `${targetProd.nome}: agora com ${novoEstoque} un.`);
    } catch (err: unknown) {
      console.error('Erro ao ajustar estoque:', err);
      // Reverter estado local
      setProdutos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estoque_atual: targetProd.estoque_atual } : p))
      );
      addToast('error', 'Falha no Estoque', 'Não foi possível salvar a alteração.');
    }
  };

  // Alternar Visibilidade na Vitrine (Ativo / Inativo)
  const handleToggleAtivo = async (p: Produto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const novoStatus = !p.ativo;

    // Otimista
    setProdutos((prev) =>
      prev.map((prod) => (prod.id === p.id ? { ...prod, ativo: novoStatus } : prod))
    );

    try {
      const { error } = await supabase
        .from('produtos')
        .update({
          ativo: novoStatus,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', p.id);

      if (error) throw error;

      addToast(
        novoStatus ? 'success' : 'warning',
        novoStatus ? 'Produto Ativado' : 'Produto Ocultado',
        `${p.nome} está ${novoStatus ? 'visível na vitrine' : 'oculto para os clientes'}.`
      );
    } catch (err: unknown) {
      console.error('Erro ao alterar status:', err);
      // Reverter
      setProdutos((prev) =>
        prev.map((prod) => (prod.id === p.id ? { ...prod, ativo: p.ativo } : prod))
      );
      const errMessage = err instanceof Error ? err.message : 'Falha ao alterar status.';
      addToast('error', 'Erro ao alterar status', errMessage);
    }
  };

  // Exclusão Permanente
  const handleConfirmDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      const { error } = await supabase.from('produtos').delete().eq('id', id);

      if (error) {
        // Se houver chave estrangeira em pedidos_itens, orientar inativação
        if (error.code === '23503') {
          throw new Error('Este produto possui histórico de vendas e não pode ser excluído permanentemente. Utilize a opção de "Ocultar da Vitrine".');
        }
        throw error;
      }

      setProdutos((prev) => prev.filter((p) => p.id !== id));
      addToast('success', 'Produto Excluído', 'O item foi removido do banco de dados.');
      setDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (err: unknown) {
      console.error('Erro ao deletar produto:', err);
      const errMessage = err instanceof Error ? err.message : 'Erro ao tentar deletar o produto.';
      addToast('error', 'Falha na Exclusão', errMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Inativação (Soft Delete)
  const handleConfirmInactivate = async (id: string) => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('produtos')
        .update({ ativo: false, atualizado_em: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setProdutos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ativo: false } : p))
      );
      addToast('warning', 'Produto Ocultado', 'O produto foi desativado e não aparecerá na vitrine.');
      setDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (err: unknown) {
      console.error('Erro ao desativar produto:', err);
      const errMessage = err instanceof Error ? err.message : 'Falha ao desativar produto.';
      addToast('error', 'Erro', errMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Gestão de Produtos & Estoque
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Controle instantâneo de preços, catálogo e saldo de mercadorias
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Destaque + Adicionar Produto */}
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
            onClick={handleOpenCreateModal}
            className="flex-1 md:flex-initial bg-[#F59E0B] hover:bg-[#d97706] text-black font-extrabold px-5 py-3.5 rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 text-sm transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Adicionar Produto</span>
          </button>
        </div>
      </div>

      {/* 2. Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total de Produtos */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Total de Produtos
            </p>
            <p className="text-2xl sm:text-3xl font-black text-white">
              {loading ? '-' : metrics.total}
            </p>
            <p className="text-[11px] text-zinc-500">Itens cadastrados no catálogo</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Estoque Baixo / Crítico */}
        <div
          onClick={() =>
            setSelectedStatusFilter((prev) => (prev === 'critico' ? 'todos' : 'critico'))
          }
          className={`bg-[#161616] border rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-md cursor-pointer transition ${
            selectedStatusFilter === 'critico'
              ? 'border-red-500 ring-1 ring-red-500'
              : 'border-[#262626] hover:border-amber-500/40'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Estoque Baixo
              </p>
              {metrics.critico > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse">
                  Atenção
                </span>
              )}
            </div>
            <p
              className={`text-2xl sm:text-3xl font-black ${
                metrics.critico > 0 ? 'text-red-400' : 'text-white'
              }`}
            >
              {loading ? '-' : metrics.critico}
            </p>
            <p className="text-[11px] text-zinc-500">Abaixo ou no limite mínimo</p>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              metrics.critico > 0
                ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                : 'bg-[#262626]/50 text-zinc-500'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Produtos Ativos na Vitrine */}
        <div
          onClick={() =>
            setSelectedStatusFilter((prev) => (prev === 'ativo' ? 'todos' : 'ativo'))
          }
          className={`bg-[#161616] border rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-md cursor-pointer transition ${
            selectedStatusFilter === 'ativo'
              ? 'border-emerald-500 ring-1 ring-emerald-500'
              : 'border-[#262626] hover:border-emerald-500/40'
          }`}
        >
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Ativos na Vitrine
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400">
              {loading ? '-' : metrics.ativos}
            </p>
            <p className="text-[11px] text-zinc-500">Visíveis para compra no delivery</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Eye className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Barra de Pesquisa e Filtros Rápidos */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nome, marca ou descrição..."
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

          {/* Filtros de Status (Chips) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'todos' as const, label: 'Todos' },
              { id: 'critico' as const, label: 'Estoque Baixo', badge: metrics.critico },
              { id: 'ativo' as const, label: 'Ativos' },
              { id: 'inativo' as const, label: 'Ocultos' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedStatusFilter(f.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  selectedStatusFilter === f.id
                    ? 'bg-[#F59E0B] text-black shadow-md'
                    : 'bg-[#161616] border border-[#262626] text-zinc-400 hover:text-white'
                }`}
              >
                <span>{f.label}</span>
                {f.badge !== undefined && f.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      selectedStatusFilter === f.id ? 'bg-black text-[#F59E0B]' : 'bg-red-500 text-white'
                    }`}
                  >
                    {f.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chips de Categorias Horizontais */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoriaId('todas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
              selectedCategoriaId === 'todas'
                ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B]'
                : 'bg-[#161616] border border-[#262626] text-zinc-400 hover:text-white'
            }`}
          >
            <span>Todas as Categorias</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-mono">
              {categoryCounts.todas || 0}
            </span>
          </button>

          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoriaId(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                selectedCategoriaId === cat.id
                  ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B]'
                  : 'bg-[#161616] border border-[#262626] text-zinc-400 hover:text-white'
              }`}
            >
              <span>{cat.nome}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-mono">
                {categoryCounts[cat.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Listagem de Produtos (Visualização Híbrida: Mobile Cards vs Desktop Tabela) */}
      {loading ? (
        <div className="bg-[#161616] border border-[#262626] rounded-3xl p-16 text-center space-y-3 shadow-xl">
          <Loader2 className="w-10 h-10 text-[#F59E0B] animate-spin mx-auto" />
          <p className="text-sm font-bold text-zinc-300">Carregando catálogo de produtos...</p>
        </div>
      ) : filteredProdutos.length === 0 ? (
        <div className="bg-[#161616] border border-[#262626] rounded-3xl p-12 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center mx-auto text-zinc-500">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Nenhum produto encontrado</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Tente alterar os termos da busca ou os filtros de categoria/status acima.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-xl bg-[#F59E0B] text-black font-bold text-xs inline-flex items-center gap-1.5 hover:bg-[#d97706] transition"
          >
            <Plus className="w-4 h-4" /> Cadastrar Novo Produto
          </button>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 4A. VISUALIZAÇÃO MOBILE (CARDS GRANDES & TOUCH-FRIENDLY) - md:hidden      */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredProdutos.map((p) => {
              const isCritico = p.estoque_atual <= p.estoque_minimo;
              const isEsgotado = p.estoque_atual === 0;

              return (
                <div
                  key={p.id}
                  className={`bg-[#161616] border ${
                    isCritico ? 'border-amber-500/40' : 'border-[#262626]'
                  } rounded-2xl p-4 shadow-md space-y-4`}
                >
                  {/* Topo do Card: Imagem + Detalhes */}
                  <div className="flex items-start gap-3.5">
                    {/* Imagem do Produto com Badge de Status */}
                    <div className="relative w-20 h-20 rounded-2xl bg-[#0D0D0D] border border-[#262626] overflow-hidden shrink-0 flex items-center justify-center">
                      {p.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.foto_url}
                          alt={p.nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-zinc-600" />
                      )}

                      {/* Pill de Destaque */}
                      {p.destaque && (
                        <div className="absolute top-1 left-1 bg-[#F59E0B] text-black p-1 rounded-md shadow">
                          <Sparkles className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Informações Principais */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-[#0D0D0D] px-2 py-0.5 rounded-md border border-[#262626]">
                          {p.categoria?.nome || 'Geral'}
                        </span>

                        {/* Status Badge */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleAtivo(p, e)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                            p.ativo
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {p.ativo ? (
                            <>
                              <Eye className="w-3 h-3" /> Ativo
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Oculto
                            </>
                          )}
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-white leading-snug line-clamp-2">
                        {p.nome}
                      </h3>

                      <p className="text-lg font-black text-[#F59E0B]">
                        R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>

                  {/* Bloco de Controle de Estoque Instantâneo (Grandes Botões Touch) */}
                  <div className="p-3 bg-[#0D0D0D] border border-[#262626] rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Saldo de Estoque
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-base font-mono font-black ${isCritico ? 'text-amber-400' : 'text-white'}`}>
                          {p.estoque_atual} un
                        </span>
                        {isCritico && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {isEsgotado ? 'Esgotado' : `Mín: ${p.estoque_minimo}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botões de Aumento e Redução Touch-Friendly (Mínimo 44x44px) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleAdjustEstoque(p.id, -1, e)}
                        disabled={p.estoque_atual <= 0}
                        className="w-11 h-11 rounded-xl bg-[#161616] hover:bg-[#222222] border border-[#262626] text-white flex items-center justify-center font-bold text-lg active:scale-95 transition disabled:opacity-30 cursor-pointer"
                        title="Diminuir 1 unidade"
                      >
                        <Minus className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleAdjustEstoque(p.id, 1, e)}
                        className="w-11 h-11 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-black flex items-center justify-center font-bold text-lg active:scale-95 shadow-md shadow-amber-500/10 transition cursor-pointer"
                        title="Adicionar 1 unidade"
                      >
                        <Plus className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Ações Rápidas de Edição e Exclusão */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(p)}
                      className="flex-1 h-11 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-[#F59E0B]/50 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Edit2 className="w-4 h-4 text-[#F59E0B]" />
                      Editar Dados
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(p)}
                      className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition shrink-0"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* 4B. VISUALIZAÇÃO DESKTOP (TABELA VISUAL & MODERNA) - hidden md:block       */}
          {/* ========================================================================= */}
          <div className="hidden md:block bg-[#161616] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-[#111111] border-b border-[#262626] text-zinc-400 uppercase text-[11px] font-black tracking-wider">
                  <tr>
                    <th className="py-4 px-5">Produto</th>
                    <th className="py-4 px-4">Categoria</th>
                    <th className="py-4 px-4">Preço (R$)</th>
                    <th className="py-4 px-4">Estoque Atual</th>
                    <th className="py-4 px-4 text-center">Vitrine</th>
                    <th className="py-4 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]">
                  {filteredProdutos.map((p) => {
                    const isCritico = p.estoque_atual <= p.estoque_minimo;
                    const isEsgotado = p.estoque_atual === 0;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-[#1a1a1a] transition group"
                      >
                        {/* Imagem + Nome + Destaque */}
                        <td className="py-4 px-5 font-bold text-white">
                          <div className="flex items-center gap-3.5">
                            <div className="relative w-12 h-12 rounded-xl bg-[#0D0D0D] border border-[#262626] overflow-hidden flex items-center justify-center shrink-0">
                              {p.foto_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.foto_url}
                                  alt={p.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-6 h-6 text-zinc-600" />
                              )}
                              {p.destaque && (
                                <div className="absolute top-0.5 left-0.5 bg-[#F59E0B] text-black p-0.5 rounded shadow">
                                  <Sparkles className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 max-w-xs">
                              <p className="text-white font-bold text-sm truncate leading-snug group-hover:text-[#F59E0B] transition">
                                {p.nome}
                              </p>
                              {p.descricao && (
                                <p className="text-xs text-zinc-500 truncate font-normal">
                                  {p.descricao}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Categoria */}
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-[#0D0D0D] border border-[#262626] text-zinc-300 text-xs font-semibold">
                            {p.categoria?.nome || 'Geral'}
                          </span>
                        </td>

                        {/* Preço de Venda */}
                        <td className="py-4 px-4 font-black text-[#F59E0B] text-base">
                          R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                        </td>

                        {/* Controle Inline de Estoque com Botões - e + */}
                        <td className="py-4 px-4 font-mono">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdjustEstoque(p.id, -1)}
                              disabled={p.estoque_atual <= 0}
                              className="w-8 h-8 rounded-lg bg-[#0D0D0D] hover:bg-[#222222] border border-[#262626] text-white flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                              title="Diminuir 1"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <div className="min-w-[70px] text-center">
                              <span
                                className={`text-sm font-bold ${
                                  isCritico ? 'text-amber-400' : 'text-white'
                                }`}
                              >
                                {p.estoque_atual} un
                              </span>
                              {isCritico && (
                                <span className="block text-[9px] font-bold text-amber-500 uppercase tracking-tighter">
                                  {isEsgotado ? 'Esgotado' : 'Estoque Baixo'}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAdjustEstoque(p.id, 1)}
                              className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/40 text-[#F59E0B] flex items-center justify-center transition cursor-pointer"
                              title="Adicionar 1"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>
                        </td>

                        {/* Toggle de Vitrine */}
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAtivo(p)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition inline-flex items-center gap-1.5 ${
                              p.ativo
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                            }`}
                          >
                            {p.ativo ? (
                              <>
                                <Eye className="w-3.5 h-3.5" /> Ativo
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" /> Oculto
                              </>
                            )}
                          </button>
                        </td>

                        {/* Ações (Editar & Excluir) */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(p)}
                              className="p-2 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-400 hover:text-white hover:border-[#F59E0B]/40 transition"
                              title="Editar Produto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(p)}
                              className="p-2 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition"
                              title="Excluir Produto"
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

      {/* Modal de Formulário (Criação e Edição com Upload) */}
      <ProductFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setProductToEdit(null);
        }}
        onSuccess={handleFormSuccess}
        produtoParaEditar={productToEdit}
        categorias={categorias}
      />

      {/* Modal de Confirmação de Exclusão */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        produto={productToDelete}
        onConfirmDelete={handleConfirmDelete}
        onConfirmInactivate={handleConfirmInactivate}
        isDeleting={isDeleting}
      />

      {/* Container de Notificações Toast */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
