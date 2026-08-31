'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Bike,
  Navigation,
  Clock,
  Radio,
  AlertTriangle,
  Phone,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import {
  ADEGA_COORDINATES,
  calcularDistanciaKm,
  calcularETA,
  isSinalGPSAtivo,
} from '@/lib/geoUtils';
import { Motoboy } from '@/types/motoboy';

// Import dinâmico do Leaflet com SSR desabilitado
const DeliveryTrackerMapInner = dynamic(
  () => import('./DeliveryTrackerMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-72 md:h-96 rounded-2xl bg-[#161616] border border-[#262626] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
        <p className="text-xs text-zinc-400 font-medium">Carregando mapa em tempo real...</p>
      </div>
    ),
  }
);

interface DeliveryTrackerMapProps {
  pedidoId?: string;
  motoboyId?: string | null;
  status: string;
  enderecoCliente: {
    rua: string;
    numero: string;
    bairro: string;
    latitude?: number;
    longitude?: number;
  };
}

export function DeliveryTrackerMap({
  motoboyId,
  status,
  enderecoCliente,
}: DeliveryTrackerMapProps) {
  const [motoboy, setMotoboy] = useState<Motoboy | null>(null);

  // Destino do cliente (usa coordenadas reais se existirem ou fallback calculado a partir do bairro na Baixada Santista)
  const destinoCoords = useMemo(() => {
    if (enderecoCliente.latitude && enderecoCliente.longitude) {
      return {
        latitude: enderecoCliente.latitude,
        longitude: enderecoCliente.longitude,
      };
    }
    // Coordenadas aproximadas em Santos/Baixada Santista
    return {
      latitude: -23.9685,
      longitude: -46.3385,
    };
  }, [enderecoCliente.latitude, enderecoCliente.longitude]);

  // Carrega dados iniciais do motoboy
  useEffect(() => {
    async function fetchMotoboy() {
      if (!motoboyId) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('motoboys')
          .select('*')
          .eq('id', motoboyId)
          .single();

        if (!error && data) {
          setMotoboy(data as Motoboy);
        }
      } catch (err) {
        console.error('Erro ao buscar dados do motoboy:', err);
      }
    }

    fetchMotoboy();
  }, [motoboyId]);

  // Conexão Supabase Realtime para escutar atualizações de telemetria do motoboy
  useEffect(() => {
    if (!motoboyId) return;

    // Canal escutando updates na tabela motoboys
    const channel = supabase
      .channel(`tracking-motoboy-${motoboyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'motoboys',
          filter: `id=eq.${motoboyId}`,
        },
        (payload) => {
          const updated = payload.new as Motoboy;
          setMotoboy((prev) => ({
            ...prev,
            ...updated,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [motoboyId]);

  // Se não estiver em rota, não exibe mapa de rastreamento ativo
  if (status !== 'em_rota') {
    return null;
  }

  // Verifica se o motoboy possui coordenadas válidas
  const temPosicaoMotoboy =
    motoboy &&
    typeof motoboy.latitude === 'number' &&
    typeof motoboy.longitude === 'number';

  const sinalGPSValido = temPosicaoMotoboy
    ? isSinalGPSAtivo(motoboy.ultima_localizacao_em, 3)
    : false;

  // Ponto de referência para cálculo de distância: motoboy (se disponível) ou origem adega
  const posCalculo = temPosicaoMotoboy
    ? { lat: Number(motoboy.latitude), lng: Number(motoboy.longitude) }
    : { lat: ADEGA_COORDINATES.latitude, lng: ADEGA_COORDINATES.longitude };

  const distanciaKm = calcularDistanciaKm(
    posCalculo.lat,
    posCalculo.lng,
    destinoCoords.latitude,
    destinoCoords.longitude
  );

  const eta = calcularETA(distanciaKm);

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
      {/* Glow accent */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header com Status Dinâmico */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
            <Bike className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              Rastreamento em Tempo Real
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </h3>
            <p className="text-[11px] text-zinc-400">
              {motoboy?.nome
                ? `${motoboy.nome} está a caminho do seu endereço`
                : 'Entregador em deslocamento até você'}
            </p>
          </div>
        </div>

        {/* GPS Signal Status Badge */}
        <div className="flex items-center gap-2">
          {sinalGPSValido ? (
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-2.5 py-1 rounded-full">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              GPS Conectado
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-bold px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              Sinal em atualização
            </span>
          )}
        </div>
      </div>

      {/* Metric Cards (ETA & Distância) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold block uppercase">
              Previsão de Chegada
            </span>
            <span className="text-xs font-black text-amber-400">
              {eta.minutosMin}-{eta.minutosMax} min
            </span>
          </div>
        </div>

        <div className="bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold block uppercase">
              Distância Atual
            </span>
            <span className="text-xs font-black text-purple-400">
              {eta.textoDistancia}
            </span>
          </div>
        </div>
      </div>

      {/* Mapa Interativo */}
      <DeliveryTrackerMapInner
        origem={{
          latitude: ADEGA_COORDINATES.latitude,
          longitude: ADEGA_COORDINATES.longitude,
          label: 'Teles Adega',
        }}
        destino={{
          latitude: destinoCoords.latitude,
          longitude: destinoCoords.longitude,
          label: 'Você',
          endereco: `${enderecoCliente.rua}, Nº ${enderecoCliente.numero} - ${enderecoCliente.bairro}`,
        }}
        motoboyPos={
          temPosicaoMotoboy
            ? {
                latitude: Number(motoboy.latitude),
                longitude: Number(motoboy.longitude),
                nome: motoboy.nome,
              }
            : null
        }
        sinalAtivo={sinalGPSValido}
      />

      {/* Motoboy Details / Contact Bar */}
      {motoboy && (
        <div className="bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#8B5CF6] text-white font-black text-xs flex items-center justify-center shadow-md">
              {motoboy.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {motoboy.nome}
              </span>
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                Entregador Oficial Teles Adega
              </span>
            </div>
          </div>

          {motoboy.telefone && (
            <a
              href={`https://wa.me/55${motoboy.telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#22C55E]/15 hover:bg-[#22C55E]/25 text-[#22C55E] border border-[#22C55E]/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Phone className="w-3.5 h-3.5" />
              Contatar
            </a>
          )}
        </div>
      )}
    </div>
  );
}
