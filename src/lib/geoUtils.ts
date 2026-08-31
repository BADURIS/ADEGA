/**
 * Utilitários de Geolocalização e Cálculo de ETA para Teles Adega Delivery
 * Focado na topologia urbana da Baixada Santista (velocidade média de entregas ~25 km/h)
 */

// Coordenadas padrão da sede da Teles Adega Delivery (Baixada Santista)
export const ADEGA_COORDINATES = {
  latitude: -23.9618,
  longitude: -46.3322,
  nome: 'Teles Adega Delivery - Sede',
  endereco: 'Baixada Santista, SP',
};

/**
 * Calcula a distância em quilômetros entre duas coordenadas geográficas
 * utilizando a fórmula trigonométrica de Haversine.
 */
export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2) ||
    (lat1 === lat2 && lon1 === lon2)
  ) {
    return 0;
  }

  const R = 6371; // Raio médio da Terra em km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distancia = R * c;

  return Number(distancia.toFixed(2));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export interface ETAResult {
  distanciaKm: number;
  minutosMin: number;
  minutosMax: number;
  textoDistancia: string;
  textoTempo: string;
}

/**
 * Calcula a estimativa de tempo de chegada (ETA)
 * Baseado na distância calculada + velocidade média da moto (padrão: 25 km/h) + margem semafórica (3 min)
 */
export function calcularETA(
  distanciaKm: number,
  velocidadeMediaKmh: number = 25
): ETAResult {
  if (distanciaKm <= 0.05) {
    return {
      distanciaKm: 0,
      minutosMin: 1,
      minutosMax: 3,
      textoDistancia: 'No seu endereço',
      textoTempo: 'Chegando agora!',
    };
  }

  // Tempo base em minutos = (distância / velocidade) * 60
  const tempoBaseMinutos = (distanciaKm / velocidadeMediaKmh) * 60;
  const margemSemafaroMinutos = 3;

  const minutosMin = Math.max(2, Math.round(tempoBaseMinutos + 1));
  const minutosMax = Math.max(minutosMin + 2, Math.round(tempoBaseMinutos + margemSemafaroMinutos + 3));

  const textoDistancia = formatarDistancia(distanciaKm);
  const textoTempo = `Chegando em aprox. ${minutosMin}-${minutosMax} min`;

  return {
    distanciaKm,
    minutosMin,
    minutosMax,
    textoDistancia,
    textoTempo,
  };
}

/**
 * Formata distância para exibição amigável ao usuário (metros ou quilômetros)
 */
export function formatarDistancia(distanciaKm: number): string {
  if (distanciaKm < 1) {
    const metros = Math.round(distanciaKm * 1000);
    return `A ${metros} m de você`;
  }
  return `A ${distanciaKm.toFixed(1).replace('.', ',')} km de você`;
}

/**
 * Verifica se a última localização recebida do GPS ainda é recente (dentro da tolerância em minutos)
 */
export function isSinalGPSAtivo(
  ultimaLocalizacaoEm?: string | null,
  toleranciaMinutos: number = 2
): boolean {
  if (!ultimaLocalizacaoEm) return false;
  try {
    const timestamp = new Date(ultimaLocalizacaoEm).getTime();
    if (isNaN(timestamp)) return false;
    const diferencaMs = Date.now() - timestamp;
    const limiteMs = toleranciaMinutos * 60 * 1000;
    return diferencaMs <= limiteMs;
  } catch {
    return false;
  }
}
