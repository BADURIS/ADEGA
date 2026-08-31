/**
 * Utilitário de Exportação de Dados para formato CSV com suporte UTF-8 BOM
 * e formatação compatível com Microsoft Excel no Brasil (separador ponto-e-vírgula).
 */

export interface ExportCSVOptions {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

/**
 * Função utilitária pura para gerar arquivo CSV com UTF-8 BOM e disparar o download.
 */
export function exportToCSV({ filename, headers, rows }: ExportCSVOptions): void {
  // Prepara as linhas com escape adequado para delimitador ';' e quebras de linha
  const escapeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '';
    const stringValue = String(cell);
    // Se contiver aspas, ponto-e-vírgula ou quebras de linha, envolve em aspas duplas
    if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const headerLine = headers.map(escapeCell).join(';');
  const dataLines = rows.map((row) => row.map(escapeCell).join(';'));
  const csvContent = [headerLine, ...dataLines].join('\r\n');

  // Adiciona o Byte Order Mark (BOM) UTF-8 (\uFEFF) para garantir abertura sem erros de acentuação no Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface PedidoExport {
  id?: string;
  criado_em?: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_whatsapp?: string;
  endereco_bairro?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  forma_pagamento?: string;
  status?: string;
  motoboy?: { id?: string; nome: string; telefone?: string } | null;
  motoboy_id?: string | null;
  valor_produtos?: number;
  taxa_entrega?: number;
  valor_total?: number;
}

export interface ClienteExport {
  id?: string;
  nome?: string;
  whatsapp?: string;
  bairro?: string;
  endereco_completo?: string;
  limite_fiado?: number;
  saldo_fiado_atual?: number;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ProdutoRankingExport {
  nome: string;
  categoria?: string;
  quantidade_vendida?: number;
  receita_total?: number;
}

export interface MotoboyExport {
  id?: string;
  nome: string;
  telefone?: string;
  ativo?: boolean;
  total_entregas: number;
  total_dinheiro?: number;
  total_pix?: number;
  total_fiado?: number;
  total_taxas?: number;
  total_faturado?: number;
}

/**
 * Exporta Extrato de Vendas do Período
 */
export function exportVendasCSV(pedidos: PedidoExport[], periodoLabel: string): void {
  const headers = [
    'ID Pedido',
    'Data / Hora',
    'Cliente',
    'WhatsApp',
    'Bairro',
    'Endereço',
    'Forma de Pagamento',
    'Status',
    'Motoboy',
    'Valor Produtos (R$)',
    'Taxa Entrega (R$)',
    'Valor Total (R$)',
  ];

  const rows = pedidos.map((p) => [
    p.id ? `#${p.id.slice(0, 8)}` : '',
    p.criado_em ? new Date(p.criado_em).toLocaleString('pt-BR') : '',
    p.cliente_nome || 'Consumidor',
    p.cliente_whatsapp || '',
    p.endereco_bairro || '',
    `${p.endereco_rua || ''}, ${p.endereco_numero || ''} ${p.endereco_complemento ? `(${p.endereco_complemento})` : ''}`,
    (p.forma_pagamento || '').toUpperCase(),
    (p.status || '').toUpperCase(),
    p.motoboy?.nome || 'Não atribuído',
    Number(p.valor_produtos || 0).toFixed(2).replace('.', ','),
    Number(p.taxa_entrega || 0).toFixed(2).replace('.', ','),
    Number(p.valor_total || 0).toFixed(2).replace('.', ','),
  ]);

  const sanitizedPeriodo = periodoLabel.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  exportToCSV({
    filename: `vendas_teles_adega_${sanitizedPeriodo}`,
    headers,
    rows,
  });
}

/**
 * Exporta Relatório de Clientes e Inadimplência do Fiado
 */
export function exportFiadoCSV(clientes: ClienteExport[]): void {
  const headers = [
    'ID Cliente',
    'Nome do Cliente',
    'WhatsApp',
    'Bairro',
    'Endereço',
    'Limite Concedido (R$)',
    'Saldo Devedor Atual (R$)',
    'Saldo Disponível (R$)',
    'Status da Conta',
    'Data do Cadastro',
  ];

  const rows = clientes.map((c) => {
    const limite = Number(c.limite_fiado || 0);
    const saldo = Number(c.saldo_fiado_atual || 0);
    const disponivel = Math.max(0, limite - saldo);
    const status = saldo > 0 ? 'PENDENTE / DEVEDOR' : 'EM DIA';

    return [
      c.id ? `#${c.id.slice(0, 8)}` : '',
      c.nome || '',
      c.whatsapp || '',
      c.bairro || '',
      c.endereco_completo || '',
      limite.toFixed(2).replace('.', ','),
      saldo.toFixed(2).replace('.', ','),
      disponivel.toFixed(2).replace('.', ','),
      status,
      c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '',
    ];
  });

  exportToCSV({
    filename: `relatorio_fiado_teles_adega_${new Date().toISOString().split('T')[0]}`,
    headers,
    rows,
  });
}

/**
 * Exporta Desempenho por Produto / Ranking Top Sellers
 */
export function exportTopSellersCSV(produtosRanking: ProdutoRankingExport[], periodoLabel: string): void {
  const headers = [
    'Posição',
    'Produto',
    'Categoria',
    'Unidades Vendidas',
    'Receita Gerada (R$)',
    'Ticket Médio Unitário (R$)',
  ];

  const rows = produtosRanking.map((item, index) => {
    const units = Number(item.quantidade_vendida || 0);
    const revenue = Number(item.receita_total || 0);
    const avgPrice = units > 0 ? revenue / units : 0;

    return [
      index + 1,
      item.nome,
      item.categoria || 'Geral',
      units,
      revenue.toFixed(2).replace('.', ','),
      avgPrice.toFixed(2).replace('.', ','),
    ];
  });

  const sanitizedPeriodo = periodoLabel.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  exportToCSV({
    filename: `top_sellers_teles_adega_${sanitizedPeriodo}`,
    headers,
    rows,
  });
}

/**
 * Exporta Produtividade e Acerto de Caixa dos Motoboys
 */
export function exportMotoboysCSV(motoboysData: MotoboyExport[], periodoLabel: string): void {
  const headers = [
    'Motoboy',
    'Telefone',
    'Entregas Concluídas',
    'Total Dinheiro Físico (R$)',
    'Total Pix (R$)',
    'Total Fiado (R$)',
    'Total Taxas Frete (R$)',
    'Faturamento Total Transportado (R$)',
  ];

  const rows = motoboysData.map((m) => [
    m.nome,
    m.telefone || '',
    m.total_entregas,
    Number(m.total_dinheiro || 0).toFixed(2).replace('.', ','),
    Number(m.total_pix || 0).toFixed(2).replace('.', ','),
    Number(m.total_fiado || 0).toFixed(2).replace('.', ','),
    Number(m.total_taxas || 0).toFixed(2).replace('.', ','),
    Number(m.total_faturado || 0).toFixed(2).replace('.', ','),
  ]);

  const sanitizedPeriodo = periodoLabel.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  exportToCSV({
    filename: `produtividade_motoboys_${sanitizedPeriodo}`,
    headers,
    rows,
  });
}
