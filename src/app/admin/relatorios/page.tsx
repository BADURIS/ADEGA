'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  CreditCard,
  Truck,
  Download,
  Printer,
  RefreshCw,
  Loader2,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Package,
  Bike,
  MessageCircle,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import {
  exportVendasCSV,
  exportFiadoCSV,
  exportTopSellersCSV,
  exportMotoboysCSV,
  PedidoExport,
  ClienteExport,
  MotoboyExport,
} from '@/lib/exportUtils';

type PeriodFilterType = 'hoje' | '7dias' | 'mesAtual' | 'custom';

export interface RelatorioPedidoItem {
  id?: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto_id?: string;
  produto?: {
    id?: string;
    nome: string;
    categoria?: { nome: string } | null;
  } | null;
}

export interface RelatorioPedido extends PedidoExport {
  id: string;
  itens?: RelatorioPedidoItem[];
  motoboy_id?: string | null;
}

export default function AdminRelatoriosPage() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('mesAtual');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Primeiro dia do mês atual
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dados brutos
  const [pedidos, setPedidos] = useState<RelatorioPedido[]>([]);
  const [clientes, setClientes] = useState<ClienteExport[]>([]);
  const [motoboys, setMotoboys] = useState<MotoboyExport[]>([]);

  // Aba ativa: 'vendas' | 'top_sellers' | 'fiado' | 'motoboys'
  const [activeTab, setActiveTab] = useState<'top_sellers' | 'fiado' | 'motoboys' | 'vendas'>('top_sellers');

  // Filtros internos da aba de extrato de vendas
  const [vendasSearchTerm, setVendasSearchTerm] = useState('');
  const [vendasStatusFilter, setVendasStatusFilter] = useState<string>('todos');
  const [vendasPagamentoFilter, setVendasPagamentoFilter] = useState<string>('todos');

  // Cálculo das datas limites (Início e Fim)
  const { startDateISO, endDateISO, periodoLabel } = useMemo(() => {
    const now = new Date();

    if (periodFilter === 'hoje') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        startDateISO: start.toISOString(),
        endDateISO: end.toISOString(),
        periodoLabel: `Hoje (${now.toLocaleDateString('pt-BR')})`,
      };
    }

    if (periodFilter === '7dias') {
      const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        startDateISO: start.toISOString(),
        endDateISO: end.toISOString(),
        periodoLabel: `Últimos 7 dias (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})`,
      };
    }

    if (periodFilter === 'mesAtual') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        startDateISO: start.toISOString(),
        endDateISO: end.toISOString(),
        periodoLabel: `Mês Atual (${now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})`,
      };
    }

    // Custom
    const start = new Date(`${customStartDate}T00:00:00.000`);
    const end = new Date(`${customEndDate}T23:59:59.999`);
    return {
      startDateISO: start.toISOString(),
      endDateISO: end.toISOString(),
      periodoLabel: `Período (${new Date(customStartDate + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(customEndDate + 'T12:00:00').toLocaleDateString('pt-BR')})`,
    };
  }, [periodFilter, customStartDate, customEndDate]);

  // Carregar dados do Supabase
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (isSilent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // 1. Pedidos do período com itens e motoboys
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          *,
          motoboy:motoboys(id, nome, telefone),
          itens:itens_pedido(
            id,
            quantidade,
            preco_unitario,
            subtotal,
            produto_id,
            produto:produtos(
              id,
              nome,
              categoria:categorias(nome)
            )
          )
        `)
        .gte('criado_em', startDateISO)
        .lte('criado_em', endDateISO)
        .order('criado_em', { ascending: false });

      if (pedidosError) throw pedidosError;
      setPedidos((pedidosData as RelatorioPedido[]) || []);

      // 2. Clientes (para análise de fiado)
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('saldo_fiado_atual', { ascending: false });

      if (clientesError) throw clientesError;
      setClientes((clientesData as ClienteExport[]) || []);

      // 3. Motoboys
      const { data: motoboysData, error: motoboysError } = await supabase
        .from('motoboys')
        .select('*')
        .order('nome', { ascending: true });

      if (motoboysError) throw motoboysError;
      setMotoboys((motoboysData as MotoboyExport[]) || []);
    } catch (err: unknown) {
      console.error('Erro ao carregar dados dos relatórios:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDateISO, endDateISO]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // CÁLCULOS E AGREGAÇÕES DOS KPIS
  // ==========================================

  const pedidosEntregues = useMemo(() => {
    return pedidos.filter((p) => p.status === 'entregue');
  }, [pedidos]);

  const pedidosCancelados = useMemo(() => {
    return pedidos.filter((p) => p.status === 'cancelado');
  }, [pedidos]);

  const totalPedidos = pedidos.length;
  const totalConcluidos = pedidosEntregues.length;
  const totalCancelados = pedidosCancelados.length;
  const taxaCancelamento = totalPedidos > 0 ? (totalCancelados / totalPedidos) * 100 : 0;

  // Faturamento Bruto (apenas pedidos entregues)
  const faturamentoBruto = useMemo(() => {
    return pedidosEntregues.reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
  }, [pedidosEntregues]);

  // Total em Produtos
  const totalValorProdutos = useMemo(() => {
    return pedidosEntregues.reduce((acc, p) => acc + Number(p.valor_produtos || 0), 0);
  }, [pedidosEntregues]);

  // Total Taxas de Entrega
  const totalTaxasEntrega = useMemo(() => {
    return pedidosEntregues.reduce((acc, p) => acc + Number(p.taxa_entrega || 0), 0);
  }, [pedidosEntregues]);

  // Ticket Médio
  const ticketMedio = totalConcluidos > 0 ? faturamentoBruto / totalConcluidos : 0;

  // Mix de Pagamentos
  const mixPagamento = useMemo(() => {
    let pix = 0;
    let dinheiro = 0;
    let fiado = 0;

    let qtdPix = 0;
    let qtdDinheiro = 0;
    let qtdFiado = 0;

    pedidosEntregues.forEach((p) => {
      const val = Number(p.valor_total || 0);
      if (p.forma_pagamento === 'pix') {
        pix += val;
        qtdPix++;
      } else if (p.forma_pagamento === 'dinheiro') {
        dinheiro += val;
        qtdDinheiro++;
      } else if (p.forma_pagamento === 'fiado') {
        fiado += val;
        qtdFiado++;
      }
    });

    const pctPix = faturamentoBruto > 0 ? (pix / faturamentoBruto) * 100 : 0;
    const pctDinheiro = faturamentoBruto > 0 ? (dinheiro / faturamentoBruto) * 100 : 0;
    const pctFiado = faturamentoBruto > 0 ? (fiado / faturamentoBruto) * 100 : 0;

    return {
      pix,
      qtdPix,
      pctPix,
      dinheiro,
      qtdDinheiro,
      pctDinheiro,
      fiado,
      qtdFiado,
      pctFiado,
    };
  }, [pedidosEntregues, faturamentoBruto]);

  // ==========================================
  // RANKING DE PRODUTOS MAIS VENDIDOS (TOP SELLERS)
  // ==========================================
  const produtosRanking = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; categoria: string; quantidade_vendida: number; receita_total: number }>();

    pedidosEntregues.forEach((p) => {
      (p.itens || []).forEach((item: RelatorioPedidoItem) => {
        const prodId = item.produto_id || item.produto?.id || item.id || 'prod-unknown';
        const prodNome = item.produto?.nome || 'Produto sem nome';
        const categoriaNome = item.produto?.categoria?.nome || 'Geral';
        const qty = Number(item.quantidade || 0);
        const sub = Number(item.subtotal || item.preco_unitario * qty || 0);

        if (!map.has(prodId)) {
          map.set(prodId, {
            id: prodId,
            nome: prodNome,
            categoria: categoriaNome,
            quantidade_vendida: 0,
            receita_total: 0,
          });
        }

        const current = map.get(prodId)!;
        current.quantidade_vendida += qty;
        current.receita_total += sub;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.quantidade_vendida - a.quantidade_vendida);
  }, [pedidosEntregues]);

  // ==========================================
  // RELATÓRIO DE INADIMPLÊNCIA DO FIADO
  // ==========================================
  const clientesDevedores = useMemo(() => {
    return clientes
      .filter((c) => Number(c.saldo_fiado_atual || 0) > 0)
      .map((c) => {
        // Encontrar último pedido deste cliente
        const pedidosCliente = pedidos.filter((p) => p.cliente_id === c.id || p.cliente_whatsapp === c.whatsapp);
        const ultimoPedido = pedidosCliente.length > 0 ? pedidosCliente[0].criado_em : c.atualizado_em || c.criado_em;

        return {
          ...c,
          ultimo_pedido_em: ultimoPedido,
        };
      })
      .sort((a, b) => Number(b.saldo_fiado_atual) - Number(a.saldo_fiado_atual));
  }, [clientes, pedidos]);

  const totalSaldoFiadoPendente = useMemo(() => {
    return clientesDevedores.reduce((acc, c) => acc + Number(c.saldo_fiado_atual || 0), 0);
  }, [clientesDevedores]);

  // ==========================================
  // PRODUTIVIDADE DE MOTOBOYS
  // ==========================================
  const motoboysProdutividade = useMemo(() => {
    return motoboys.map((m) => {
      const entregasMotoboy = pedidosEntregues.filter((p) => p.motoboy_id === m.id);

      const totalDinheiro = entregasMotoboy
        .filter((p) => p.forma_pagamento === 'dinheiro')
        .reduce((acc, p) => acc + Number(p.valor_total || 0), 0);

      const totalPix = entregasMotoboy
        .filter((p) => p.forma_pagamento === 'pix')
        .reduce((acc, p) => acc + Number(p.valor_total || 0), 0);

      const totalFiado = entregasMotoboy
        .filter((p) => p.forma_pagamento === 'fiado')
        .reduce((acc, p) => acc + Number(p.valor_total || 0), 0);

      const totalTaxas = entregasMotoboy.reduce((acc, p) => acc + Number(p.taxa_entrega || 0), 0);
      const totalFaturado = entregasMotoboy.reduce((acc, p) => acc + Number(p.valor_total || 0), 0);

      return {
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        ativo: m.ativo,
        total_entregas: entregasMotoboy.length,
        total_dinheiro: totalDinheiro,
        total_pix: totalPix,
        total_fiado: totalFiado,
        total_taxas: totalTaxas,
        total_faturado: totalFaturado,
      };
    }).sort((a, b) => b.total_entregas - a.total_entregas);
  }, [motoboys, pedidosEntregues]);

  // ==========================================
  // EXTRATO DETALHADO FILTRADO
  // ==========================================
  const filteredPedidosExtrato = useMemo(() => {
    return pedidos.filter((p) => {
      // Busca
      const matchSearch =
        vendasSearchTerm === '' ||
        (p.cliente_nome && p.cliente_nome.toLowerCase().includes(vendasSearchTerm.toLowerCase())) ||
        (p.id && p.id.toLowerCase().includes(vendasSearchTerm.toLowerCase())) ||
        (p.endereco_bairro && p.endereco_bairro.toLowerCase().includes(vendasSearchTerm.toLowerCase()));

      // Status
      const matchStatus = vendasStatusFilter === 'todos' || p.status === vendasStatusFilter;

      // Pagamento
      const matchPagamento = vendasPagamentoFilter === 'todos' || p.forma_pagamento === vendasPagamentoFilter;

      return matchSearch && matchStatus && matchPagamento;
    });
  }, [pedidos, vendasSearchTerm, vendasStatusFilter, vendasPagamentoFilter]);

  // Disparar Impressão da Página
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* CABEÇALHO OFICIAL PARA IMPRESSÃO / PDF (Visível apenas em @media print)  */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black bg-white p-6 border-b-2 border-black space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight">TELES ADEGA DELIVERY</h1>
            <p className="text-xs font-semibold text-gray-700">
              CNPJ: 00.000.000/0001-00 • Telefone: (11) 99999-9999
            </p>
            <p className="text-xs text-gray-600">Av. Principal, 1000 - Delivery & Adega</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase rounded">
              Relatório Gerencial
            </span>
            <p className="text-[11px] text-gray-600 mt-1">
              Emitido em: {new Date().toLocaleString('pt-BR')}
            </p>
            <p className="text-xs font-bold text-gray-800">Período: {periodoLabel}</p>
          </div>
        </div>

        {/* Resumo Financeiro Impresso */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-300 text-xs">
          <div className="p-2 border border-gray-300 rounded">
            <span className="text-gray-600 block">Faturamento Bruto:</span>
            <strong className="text-sm">R$ {faturamentoBruto.toFixed(2).replace('.', ',')}</strong>
          </div>
          <div className="p-2 border border-gray-300 rounded">
            <span className="text-gray-600 block">Pedidos Entregues:</span>
            <strong className="text-sm">{totalConcluidos} pedidos</strong>
          </div>
          <div className="p-2 border border-gray-300 rounded">
            <span className="text-gray-600 block">Ticket Médio:</span>
            <strong className="text-sm">R$ {ticketMedio.toFixed(2).replace('.', ',')}</strong>
          </div>
          <div className="p-2 border border-gray-300 rounded">
            <span className="text-gray-600 block">Dinheiro em Caixa:</span>
            <strong className="text-sm">R$ {mixPagamento.dinheiro.toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CABEÇALHO TELA / DASHBOARD (Ocultado na Impressão)                       */}
      {/* ========================================================================= */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#262626] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Painel de Relatórios & KPIs
                </h1>
                <p className="text-xs text-zinc-400">
                  Consolidação financeira, faturamento por canal, rankings e exportações
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação Global (Imprimir / Exportar / Atualizar) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={loading || refreshing}
              className="px-3.5 py-2 rounded-xl bg-[#161616] border border-[#262626] hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F59E0B]' : ''}`} />
              Atualizar
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#161616] border border-[#262626] hover:border-[#F59E0B]/50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
            >
              <Printer className="w-3.5 h-3.5 text-[#F59E0B]" />
              Imprimir / PDF
            </button>

            <button
              type="button"
              onClick={() => exportVendasCSV(pedidos, periodoLabel)}
              disabled={pedidos.length === 0}
              className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-[#0D0D0D] text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg shadow-[#F59E0B]/20 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV Geral
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARRA DE FILTROS TEMPORAIS RÁPIDOS                                       */}
        {/* ========================================================================= */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-zinc-400 mr-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#F59E0B]" />
              Período:
            </span>

            <button
              type="button"
              onClick={() => setPeriodFilter('hoje')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                periodFilter === 'hoje'
                  ? 'bg-[#F59E0B] text-[#0D0D0D] border-[#F59E0B] shadow-md shadow-[#F59E0B]/10'
                  : 'bg-[#0D0D0D] text-zinc-400 border-[#262626] hover:text-white'
              }`}
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() => setPeriodFilter('7dias')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                periodFilter === '7dias'
                  ? 'bg-[#F59E0B] text-[#0D0D0D] border-[#F59E0B] shadow-md shadow-[#F59E0B]/10'
                  : 'bg-[#0D0D0D] text-zinc-400 border-[#262626] hover:text-white'
              }`}
            >
              Últimos 7 dias
            </button>

            <button
              type="button"
              onClick={() => setPeriodFilter('mesAtual')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                periodFilter === 'mesAtual'
                  ? 'bg-[#F59E0B] text-[#0D0D0D] border-[#F59E0B] shadow-md shadow-[#F59E0B]/10'
                  : 'bg-[#0D0D0D] text-zinc-400 border-[#262626] hover:text-white'
              }`}
            >
              Mês Atual
            </button>

            <button
              type="button"
              onClick={() => setPeriodFilter('custom')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                periodFilter === 'custom'
                  ? 'bg-[#F59E0B] text-[#0D0D0D] border-[#F59E0B] shadow-md shadow-[#F59E0B]/10'
                  : 'bg-[#0D0D0D] text-zinc-400 border-[#262626] hover:text-white'
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Seletores de Data Personalizada */}
          {periodFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">De:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-1.5 rounded-xl text-xs outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">Até:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-1.5 rounded-xl text-xs outline-none"
                />
              </div>
            </div>
          )}

          <div className="text-right text-[11px] text-zinc-400 hidden lg:block font-medium">
            Exibindo dados de: <strong className="text-white">{periodoLabel}</strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARDS DE MÉTRICAS CONSOLIDADAS (KPIS)                                     */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-10 h-10 text-[#F59E0B] animate-spin mx-auto mb-3" />
          <p className="text-xs text-zinc-400">Calculando agregações e relatórios do período...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Faturamento Bruto */}
            <div className="bg-[#161616] border border-[#22C55E]/30 bg-[#22C55E]/5 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#22C55E] uppercase tracking-wider">
                  Faturamento Bruto
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-2xl md:text-3xl font-black text-white block">
                  R$ {faturamentoBruto.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  {totalConcluidos} pedidos entregues concluídos
                </span>
              </div>
              <div className="pt-2 border-t border-[#262626] flex justify-between text-[11px] text-zinc-500">
                <span>Produtos: R$ {totalValorProdutos.toFixed(2).replace('.', ',')}</span>
                <span>Fretes: R$ {totalTaxasEntrega.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Card 2: Volume de Pedidos & Cancelamentos */}
            <div className="bg-[#161616] border border-[#262626] p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Volume de Pedidos
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-2xl md:text-3xl font-black text-white block">
                  {totalPedidos}
                </span>
                <span className="text-[11px] text-zinc-400 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                  {totalConcluidos} entregues ({totalPedidos > 0 ? ((totalConcluidos / totalPedidos) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="pt-2 border-t border-[#262626] flex justify-between text-[11px]">
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {totalCancelados} cancelados
                </span>
                <span className="text-zinc-500 font-semibold">
                  Taxa Canc.: {taxaCancelamento.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Card 3: Ticket Médio */}
            <div className="bg-[#161616] border border-[#262626] p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider">
                  Ticket Médio
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-2xl md:text-3xl font-black text-white block">
                  R$ {ticketMedio.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  Média por pedido entregue
                </span>
              </div>
              <div className="pt-2 border-t border-[#262626] flex justify-between text-[11px] text-zinc-500">
                <span>Total Líquido</span>
                <span className="text-zinc-300 font-semibold">
                  {totalConcluidos > 0 ? `R$ ${(totalValorProdutos / totalConcluidos).toFixed(2).replace('.', ',')}` : 'R$ 0,00'} em itens
                </span>
              </div>
            </div>

            {/* Card 4: Total Taxas de Entrega (Fretes) */}
            <div className="bg-[#161616] border border-[#262626] p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Taxas de Frete
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-2xl md:text-3xl font-black text-white block">
                  R$ {totalTaxasEntrega.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  Arrecadado em entregas
                </span>
              </div>
              <div className="pt-2 border-t border-[#262626] flex justify-between text-[11px] text-zinc-500">
                <span>Média / Entrega</span>
                <span className="text-purple-400 font-semibold">
                  {totalConcluidos > 0 ? `R$ ${(totalTaxasEntrega / totalConcluidos).toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MIX DE PAGAMENTOS (DISTRIBUIÇÃO PIX, DINHEIRO E FIADO)                   */}
          {/* ========================================================================= */}
          <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262626] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#F59E0B]" />
                  Mix de Pagamentos & Liquidez
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Divisão da receita entre Pix (online), Dinheiro (motoboy) e Fiado (a receber)
                </p>
              </div>
              <span className="text-xs font-bold text-zinc-300">
                Total:{' '}
                <strong className="text-[#22C55E]">
                  R$ {faturamentoBruto.toFixed(2).replace('.', ',')}
                </strong>
              </span>
            </div>

            {/* Barra de Progresso Visual Multi-Segmento */}
            <div className="w-full h-3.5 bg-[#0D0D0D] rounded-full overflow-hidden flex border border-[#262626]">
              <div
                style={{ width: `${mixPagamento.pctPix}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Pix: ${mixPagamento.pctPix.toFixed(1)}%`}
              />
              <div
                style={{ width: `${mixPagamento.pctDinheiro}%` }}
                className="bg-[#F59E0B] transition-all duration-500"
                title={`Dinheiro: ${mixPagamento.pctDinheiro.toFixed(1)}%`}
              />
              <div
                style={{ width: `${mixPagamento.pctFiado}%` }}
                className="bg-blue-500 transition-all duration-500"
                title={`Fiado: ${mixPagamento.pctFiado.toFixed(1)}%`}
              />
            </div>

            {/* Detalhes dos Três Meios */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Pix */}
              <div className="p-3.5 bg-[#0D0D0D] border border-emerald-500/20 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    ⚡ Pix (Conta Bancária)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                    {mixPagamento.pctPix.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-lg font-black text-white">
                    R$ {mixPagamento.pix.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {mixPagamento.qtdPix} pedidos
                  </span>
                </div>
              </div>

              {/* Dinheiro */}
              <div className="p-3.5 bg-[#0D0D0D] border border-[#F59E0B]/20 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F59E0B] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block" />
                    💵 Dinheiro (Caixa / Motoboys)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">
                    {mixPagamento.pctDinheiro.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-lg font-black text-white">
                    R$ {mixPagamento.dinheiro.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {mixPagamento.qtdDinheiro} pedidos
                  </span>
                </div>
              </div>

              {/* Fiado */}
              <div className="p-3.5 bg-[#0D0D0D] border border-blue-500/20 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    📋 Fiado (Débito em Aberto)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                    {mixPagamento.pctFiado.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-lg font-black text-white">
                    R$ {mixPagamento.fiado.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {mixPagamento.qtdFiado} pedidos
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NAVEGAÇÃO DE ABAS PARA RELATÓRIOS INDIVIDUAIS                            */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto border-b border-[#262626] pb-2 print:hidden">
              <button
                type="button"
                onClick={() => setActiveTab('top_sellers')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'top_sellers'
                    ? 'bg-[#F59E0B] text-[#0D0D0D] shadow-lg shadow-[#F59E0B]/10 font-black'
                    : 'bg-[#161616] text-zinc-400 hover:text-white hover:bg-[#222222]'
                }`}
              >
                <Package className="w-4 h-4" />
                Top Sellers ({produtosRanking.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fiado')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'fiado'
                    ? 'bg-[#F59E0B] text-[#0D0D0D] shadow-lg shadow-[#F59E0B]/10 font-black'
                    : 'bg-[#161616] text-zinc-400 hover:text-white hover:bg-[#222222]'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                Inadimplência do Fiado ({clientesDevedores.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('motoboys')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'motoboys'
                    ? 'bg-[#F59E0B] text-[#0D0D0D] shadow-lg shadow-[#F59E0B]/10 font-black'
                    : 'bg-[#161616] text-zinc-400 hover:text-white hover:bg-[#222222]'
                }`}
              >
                <Bike className="w-4 h-4" />
                Produtividade Motoboys ({motoboysProdutividade.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vendas')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'vendas'
                    ? 'bg-[#F59E0B] text-[#0D0D0D] shadow-lg shadow-[#F59E0B]/10 font-black'
                    : 'bg-[#161616] text-zinc-400 hover:text-white hover:bg-[#222222]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Extrato Geral de Vendas ({pedidos.length})
              </button>
            </div>

            {/* ========================================================================= */}
            {/* CONTEÚDO DA ABA: 1. TOP SELLERS / PRODUTOS MAIS VENDIDOS                  */}
            {/* ========================================================================= */}
            {(activeTab === 'top_sellers' || typeof window === 'undefined') && (
              <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#F59E0B]" />
                      Ranking de Produtos Mais Vendidos (Top Sellers)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Produtos com maior saída volumétrica e receita no período selecionado
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportTopSellersCSV(produtosRanking, periodoLabel)}
                    disabled={produtosRanking.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-[#F59E0B]/50 text-white text-xs font-bold transition flex items-center gap-1.5 print:hidden disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Exportar Ranking (CSV)
                  </button>
                </div>

                {produtosRanking.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 text-xs">
                    Nenhum item vendido registrado no período selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-[#0D0D0D] text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-[#262626]">
                        <tr>
                          <th className="py-3 px-4 w-16 text-center"># Pos</th>
                          <th className="py-3 px-4">Produto</th>
                          <th className="py-3 px-4">Categoria</th>
                          <th className="py-3 px-4 text-center">Qtd. Vendida</th>
                          <th className="py-3 px-4 text-right">Preço Médio</th>
                          <th className="py-3 px-4 text-right">Receita Gerada</th>
                          <th className="py-3 px-4 text-right">% do Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262626]">
                        {produtosRanking.map((prod, idx) => {
                          const pct = totalValorProdutos > 0 ? (prod.receita_total / totalValorProdutos) * 100 : 0;
                          const precoMedio = prod.quantidade_vendida > 0 ? prod.receita_total / prod.quantidade_vendida : 0;

                          return (
                            <tr key={prod.id || idx} className="hover:bg-[#222222]/50 transition">
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-black text-[11px] ${
                                    idx === 0
                                      ? 'bg-[#F59E0B] text-black font-extrabold shadow-sm'
                                      : idx === 1
                                      ? 'bg-zinc-300 text-black font-extrabold'
                                      : idx === 2
                                      ? 'bg-amber-800 text-white'
                                      : 'bg-[#0D0D0D] text-zinc-400 border border-[#262626]'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-white">
                                {prod.nome}
                              </td>
                              <td className="py-3 px-4 text-zinc-400">
                                <span className="px-2 py-0.5 rounded text-[10px] bg-[#0D0D0D] border border-[#262626]">
                                  {prod.categoria}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-white">
                                {prod.quantidade_vendida} un
                              </td>
                              <td className="py-3 px-4 text-right text-zinc-300">
                                R$ {precoMedio.toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-[#22C55E]">
                                R$ {prod.receita_total.toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-zinc-400">
                                {pct.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* CONTEÚDO DA ABA: 2. INADIMPLÊNCIA DO FIADO                                */}
            {/* ========================================================================= */}
            {activeTab === 'fiado' && (
              <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#F59E0B]" />
                      Relatório de Inadimplência & Contas Fiado Pendentes
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Total de Saldo Devedor em Aberto:{' '}
                      <strong className="text-amber-400 font-bold">
                        R$ {totalSaldoFiadoPendente.toFixed(2).replace('.', ',')}
                      </strong>{' '}
                      ({clientesDevedores.length} clientes com débito)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportFiadoCSV(clientes)}
                    disabled={clientes.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-[#F59E0B]/50 text-white text-xs font-bold transition flex items-center gap-1.5 print:hidden disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Exportar Devedores (CSV)
                  </button>
                </div>

                {clientesDevedores.length === 0 ? (
                  <div className="text-center py-10 text-emerald-400 text-xs flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8" />
                    <span>Excelente! Não há clientes com saldo devedor pendente no momento.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-[#0D0D0D] text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-[#262626]">
                        <tr>
                          <th className="py-3 px-4">Cliente</th>
                          <th className="py-3 px-4">WhatsApp</th>
                          <th className="py-3 px-4">Bairro</th>
                          <th className="py-3 px-4 text-right">Limite Concedido</th>
                          <th className="py-3 px-4 text-right">Saldo Devedor</th>
                          <th className="py-3 px-4 text-right">Limite Disponível</th>
                          <th className="py-3 px-4 text-center">% Utilizado</th>
                          <th className="py-3 px-4 text-center">Última Movimentação</th>
                          <th className="py-3 px-4 text-right print:hidden">Ação / Cobrança</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262626]">
                        {clientesDevedores.map((c) => {
                          const limite = Number(c.limite_fiado || 0);
                          const saldo = Number(c.saldo_fiado_atual || 0);
                          const disponivel = Math.max(0, limite - saldo);
                          const pctUso = limite > 0 ? (saldo / limite) * 100 : 100;

                          // WhatsApp Link Format
                          const cleanPhone = (c.whatsapp || '').replace(/\D/g, '');
                          const cobrancaMsg = `Olá, ${c.nome}! Tudo bem? Passando para lembrar do seu saldo em aberto na Teles Adega Delivery no valor de R$ ${saldo.toFixed(2).replace('.', ',')}. Caso deseje realizar o acerto via Pix ou agendar com o motoboy, estamos à disposição! 🍷🛵`;
                          const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(cobrancaMsg)}`;

                          return (
                            <tr key={c.id} className="hover:bg-[#222222]/50 transition">
                              <td className="py-3 px-4 font-bold text-white">{c.nome}</td>
                              <td className="py-3 px-4 font-mono text-zinc-300">{c.whatsapp}</td>
                              <td className="py-3 px-4 text-zinc-400">{c.bairro || 'N/A'}</td>
                              <td className="py-3 px-4 text-right font-medium text-zinc-300">
                                R$ {limite.toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-amber-400">
                                R$ {saldo.toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-zinc-400">
                                R$ {disponivel.toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    pctUso >= 90
                                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                      : 'bg-amber-500/10 text-amber-400'
                                  }`}
                                >
                                  {pctUso.toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center text-zinc-500 text-[11px]">
                                {c.ultimo_pedido_em
                                  ? new Date(c.ultimo_pedido_em).toLocaleDateString('pt-BR')
                                  : '-'}
                              </td>
                              <td className="py-3 px-4 text-right print:hidden">
                                {cleanPhone ? (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#22C55E] hover:bg-[#16a34a] text-white font-bold text-[11px] rounded-lg transition shadow shadow-[#22C55E]/10"
                                    title="Enviar mensagem amigável de cobrança via WhatsApp"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Cobrar no WhatsApp
                                  </a>
                                ) : (
                                  <span className="text-zinc-500 text-[10px]">Sem telefone</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* CONTEÚDO DA ABA: 3. PRODUTIVIDADE DE MOTOBOYS                             */}
            {/* ========================================================================= */}
            {activeTab === 'motoboys' && (
              <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Bike className="w-4 h-4 text-[#F59E0B]" />
                      Produtividade e Acertos por Entregador
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Entregas realizadas no período, volume em dinheiro físico coletado e taxas
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportMotoboysCSV(motoboysProdutividade, periodoLabel)}
                    disabled={motoboysProdutividade.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-[#F59E0B]/50 text-white text-xs font-bold transition flex items-center gap-1.5 print:hidden disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Exportar Motoboys (CSV)
                  </button>
                </div>

                {motoboysProdutividade.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 text-xs">
                    Nenhum motoboy cadastrado no sistema.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-[#0D0D0D] text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-[#262626]">
                        <tr>
                          <th className="py-3 px-4">Motoboy</th>
                          <th className="py-3 px-4">Contato</th>
                          <th className="py-3 px-4 text-center">Entregas Concluídas</th>
                          <th className="py-3 px-4 text-right">💵 Dinheiro a Prestar</th>
                          <th className="py-3 px-4 text-right">⚡ Pix Transportado</th>
                          <th className="py-3 px-4 text-right">📋 Fiado Entregue</th>
                          <th className="py-3 px-4 text-right">Total Fretes</th>
                          <th className="py-3 px-4 text-right">Volume Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262626]">
                        {motoboysProdutividade.map((m) => (
                          <tr key={m.id} className="hover:bg-[#222222]/50 transition">
                            <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  m.ativo ? 'bg-[#22C55E]' : 'bg-zinc-600'
                                }`}
                              />
                              {m.nome}
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400">{m.telefone || '-'}</td>
                            <td className="py-3 px-4 text-center font-bold text-white">
                              {m.total_entregas} corridas
                            </td>
                            <td className="py-3 px-4 text-right font-black text-[#22C55E]">
                              R$ {m.total_dinheiro.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-emerald-400">
                              R$ {m.total_pix.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-blue-400">
                              R$ {m.total_fiado.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-purple-400">
                              R$ {m.total_taxas.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-white">
                              R$ {m.total_faturado.toFixed(2).replace('.', ',')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* CONTEÚDO DA ABA: 4. EXTRATO GERAL DE VENDAS                               */}
            {/* ========================================================================= */}
            {activeTab === 'vendas' && (
              <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#F59E0B]" />
                      Extrato Discriminado de Pedidos
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Relação de todos os pedidos no período selecionado ({filteredPedidosExtrato.length} encontrados)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportVendasCSV(filteredPedidosExtrato, periodoLabel)}
                    disabled={filteredPedidosExtrato.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-[#F59E0B]/50 text-white text-xs font-bold transition flex items-center gap-1.5 print:hidden disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Exportar Extrato Filtrado (CSV)
                  </button>
                </div>

                {/* Filtros Internos do Extrato */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, pedido, bairro..."
                      value={vendasSearchTerm}
                      onChange={(e) => setVendasSearchTerm(e.target.value)}
                      className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white pl-9 pr-3 py-2 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <div>
                    <select
                      value={vendasStatusFilter}
                      onChange={(e) => setVendasStatusFilter(e.target.value)}
                      className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2 rounded-xl text-xs outline-none"
                    >
                      <option value="todos">Status: Todos</option>
                      <option value="entregue">Entregues (Concluídos)</option>
                      <option value="em_rota">Em Rota</option>
                      <option value="em_preparo">Em Preparo</option>
                      <option value="pendente_aprovacao">Pendente Aprovação</option>
                      <option value="cancelado">Cancelados</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={vendasPagamentoFilter}
                      onChange={(e) => setVendasPagamentoFilter(e.target.value)}
                      className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2 rounded-xl text-xs outline-none"
                    >
                      <option value="todos">Pagamento: Todos</option>
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="fiado">Fiado</option>
                    </select>
                  </div>
                </div>

                {filteredPedidosExtrato.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 text-xs">
                    Nenhum pedido encontrado com os filtros aplicados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-[#0D0D0D] text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-[#262626]">
                        <tr>
                          <th className="py-3 px-4">ID / Data</th>
                          <th className="py-3 px-4">Cliente / Endereço</th>
                          <th className="py-3 px-4">Pagamento</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Motoboy</th>
                          <th className="py-3 px-4 text-right">Itens</th>
                          <th className="py-3 px-4 text-right">Frete</th>
                          <th className="py-3 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262626]">
                        {filteredPedidosExtrato.map((p) => {
                          const statusColor =
                            p.status === 'entregue'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : p.status === 'cancelado'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : p.status === 'em_rota'
                              ? 'bg-purple-500/10 text-purple-400'
                              : 'bg-[#F59E0B]/10 text-[#F59E0B]';

                          return (
                            <tr key={p.id} className="hover:bg-[#222222]/50 transition">
                              <td className="py-3 px-4">
                                <span className="font-mono font-bold text-white block">
                                  #{p.id.slice(0, 8)}
                                </span>
                                <span className="text-[10px] text-zinc-500 block">
                                  {new Date(p.criado_em).toLocaleDateString('pt-BR')} às{' '}
                                  {new Date(p.criado_em).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <strong className="text-white block">{p.cliente_nome}</strong>
                                <span className="text-[11px] text-zinc-400 block">
                                  {p.endereco_bairro} ({p.endereco_rua}, {p.endereco_numero})
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    p.forma_pagamento === 'dinheiro'
                                      ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                                      : p.forma_pagamento === 'pix'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : 'bg-blue-500/10 text-blue-400'
                                  }`}
                                >
                                  {p.forma_pagamento}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-400 text-[11px]">
                                {p.motoboy?.nome || '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-zinc-300">
                                R$ {Number(p.valor_produtos || 0).toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-purple-400">
                                R$ {Number(p.taxa_entrega || 0).toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-white">
                                R$ {Number(p.valor_total || 0).toFixed(2).replace('.', ',')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RODAPÉ E CAMPO DE ASSINATURA PARA FECHAMENTO NA IMPRESSÃO                */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black bg-white pt-12 space-y-8">
        <div className="grid grid-cols-2 gap-12 text-center text-xs">
          <div className="space-y-1">
            <div className="border-b border-black w-64 mx-auto pb-8" />
            <p className="font-bold">Gerência / Responsável pelo Fechamento</p>
            <p className="text-[10px] text-gray-500">Teles Adega Delivery</p>
          </div>
          <div className="space-y-1">
            <div className="border-b border-black w-64 mx-auto pb-8" />
            <p className="font-bold">Conferência de Caixa / Financeiro</p>
            <p className="text-[10px] text-gray-500">Data: ____/____/________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
