export interface Categoria {
  id: string;
  nome: string;
  slug: string;
  icone?: string;
  ordem?: number;
  ativo: boolean;
}

export interface Produto {
  id: string;
  categoria_id: string;
  categoria_nome?: string;
  nome: string;
  descricao?: string;
  preco: number;
  preco_original?: number;
  preco_vigente?: number;
  em_promocao?: boolean;
  percentual_desconto?: number;
  promocao_id?: string | null;
  promocao_expira_em?: string | null;
  foto_url?: string;
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  destaque?: boolean;
  criado_em?: string;
  atualizado_em?: string;
  ultimo_alerta_estoque_em?: string | null;
  categoria?: {
    nome: string;
  } | null;
}

export interface CartItem {
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  promocao_id?: string | null;
}

export type FormaPagamento = 'pix' | 'dinheiro' | 'fiado';

export type StatusPedido =
  | 'aguardando_pagamento'
  | 'pendente_aprovacao'
  | 'em_preparo'
  | 'em_rota'
  | 'entregue'
  | 'cancelado';

export interface PedidoItem {
  id?: string;
  pedido_id?: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  promocao_id?: string | null;
}

export interface Pedido {
  id: string;
  cliente_id?: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_complemento?: string;
  ponto_referencia?: string;
  forma_pagamento: FormaPagamento;
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
  itens?: PedidoItem[];
}

export interface CartStoreState {
  itens: CartItem[];
  taxaEntrega: number;
  bairroSelecionado: string | null;

  // Ações
  addItem: (produto: Produto, quantidade?: number) => void;
  removeItem: (produtoId: string) => void;
  updateQuantity: (produtoId: string, quantidade: number) => void;
  clearCart: () => void;
  setDeliveryZone: (bairro: string, taxa: number) => void;

  // Getters / Computados
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}
