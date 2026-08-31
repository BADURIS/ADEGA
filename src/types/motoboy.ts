export interface Motoboy {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  latitude?: number | null;
  longitude?: number | null;
  precisao_metros?: number | null;
  velocidade_kmh?: number | null;
  ultima_localizacao_em?: string | null;
  criado_em?: string;
}

export interface HistoricoRotaPedido {
  id: string;
  pedido_id: string;
  motoboy_id: string;
  latitude: number;
  longitude: number;
  registrado_em: string;
}

export interface CoordenadasGPS {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
}
