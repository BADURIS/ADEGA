import { Produto } from './storefront';

export interface Promocao {
  id: string;
  produto_id: string;
  preco_promocional: number;
  data_inicio: string;
  data_fim: string;
  dias_semana: number[]; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
  produto?: Produto | null;
}

export interface PromocaoFormData {
  produto_id: string;
  preco_promocional: number | '';
  data_inicio: string;
  data_fim: string;
  dias_semana: number[];
  ativo: boolean;
}

export const DIAS_SEMANA_LABELS: { value: number; label: string; short: string }[] = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
];
