import { FormaPagamento, StatusPedido } from './storefront';

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

export interface BuscarCepResult {
  sucesso: boolean;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  taxaEntrega: number;
  bairroEncontrado: boolean;
  mensagemErro?: string;
}

export interface AddressFormData {
  cliente_nome: string;
  cliente_whatsapp: string;
  cep: string;
  endereco_rua: string;
  endereco_numero: string;
  bairro: string;
  endereco_complemento?: string;
  ponto_referencia?: string;
}

export interface PaymentFormData {
  forma_pagamento: FormaPagamento;
  troco_para?: number;
  whatsapp_fiado?: string;
}

export interface ClienteFiadoInfo {
  id?: string;
  cliente_id?: string;
  aprovado: boolean;
  saldo_disponivel: number;
  motivo_recusa?: string;
}


export interface OrderPayload {
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
  chave_idempotencia: string;
  itens: {
    produto_id: string;
    produto_nome: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }[];
}
