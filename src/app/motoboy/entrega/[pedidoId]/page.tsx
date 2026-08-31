'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Navigation,
  MapPin,
  MessageCircle,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Radio,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Motoboy } from '@/types/motoboy';
import { Pedido } from '@/types/storefront';
import { CodeValidationInput } from '@/components/admin/entregas/CodeValidationInput';

export default function MotoboyEntregaPage() {
  const params = useParams();
  const router = useRouter();
  const pedidoId = params.pedidoId as string;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Geolocalização
  const [isRastreando, setIsRastreando] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number | null;
  } | null>(null);
  const [ultimoEnvioEm, setUltimoEnvioEm] = useState<Date | null>(null);
  const [totalPingsEnviados, setTotalPingsEnviados] = useState(0);
  const [erroGPS, setErroGPS] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const ultimoEnvioTimestampRef = useRef<number>(0);
  const THROTTLE_MS = 5000; // Throttling de 5 segundos

  // Carrega dados do pedido e lista de motoboys
  const carregarDados = useCallback(async () => {
    if (!pedidoId) return;

    try {
      setLoading(true);

      const { data: pedidoData, error: pedidoErr } = await supabase
        .from('pedidos')
        .select(`
          *,
          motoboy:motoboys(*)
        `)
        .eq('id', pedidoId)
        .single();

      if (pedidoErr) throw pedidoErr;
      setPedido(pedidoData as unknown as Pedido);

      if (pedidoData.motoboy_id) {
        setSelectedMotoboyId(pedidoData.motoboy_id);
      }

      // Busca motoboys cadastrados
      const { data: motoboysData } = await supabase
        .from('motoboys')
        .select('*')
        .eq('ativo', true);

      if (motoboysData) {
        setMotoboys(motoboysData);
        if (!pedidoData.motoboy_id && motoboysData.length > 0) {
          setSelectedMotoboyId(motoboysData[0].id);
        }
      }
    } catch (err: unknown) {
      console.error('Erro ao carregar dados da entrega:', err);
      setError('Não foi possível carregar as informações desta entrega.');
    } finally {
      setLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Função para enviar coordenadas ao Supabase (com throttle)
  const enviarPosicaoSupabase = useCallback(
    async (lat: number, lng: number, accuracy?: number, speed?: number | null) => {
      const motoboyId = selectedMotoboyId || pedido?.motoboy_id;
      if (!motoboyId) return;

      const agora = Date.now();
      if (agora - ultimoEnvioTimestampRef.current < THROTTLE_MS) {
        return; // Ignora se disparado antes do throttle de 5s
      }

      ultimoEnvioTimestampRef.current = agora;

      try {
        // Tenta via RPC customizado ou fallback para update direto
        const { error: rpcError } = await supabase.rpc('fn_atualizar_posicao_motoboy', {
          p_motoboy_id: motoboyId,
          p_latitude: lat,
          p_longitude: lng,
          p_precisao: accuracy || null,
          p_pedido_id: pedidoId,
        });

        if (rpcError) {
          // Fallback caso a RPC não esteja provisionada
          await supabase
            .from('motoboys')
            .update({
              latitude: lat,
              longitude: lng,
              precisao_metros: accuracy || null,
              velocidade_kmh: speed ? Number((speed * 3.6).toFixed(1)) : null,
              ultima_localizacao_em: new Date().toISOString(),
            })
            .eq('id', motoboyId);

          await supabase.from('historico_rota_pedidos').insert({
            pedido_id: pedidoId,
            motoboy_id: motoboyId,
            latitude: lat,
            longitude: lng,
          });
        }

        setUltimoEnvioEm(new Date());
        setTotalPingsEnviados((prev) => prev + 1);
      } catch (err) {
        console.error('Erro ao sincronizar localização do motoboy:', err);
      }
    },
    [pedidoId, selectedMotoboyId, pedido?.motoboy_id]
  );

  // Iniciar / Pausar Rastreamento de GPS
  const handleToggleRastreamento = () => {
    if (isRastreando) {
      // Parar rastreamento
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsRastreando(false);
    } else {
      // Iniciar rastreamento
      if (!('geolocation' in navigator)) {
        setErroGPS('Seu navegador não suporta a API de Geolocalização.');
        return;
      }

      setErroGPS(null);
      setIsRastreando(true);

      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, speed } = position.coords;
          setGpsCoords({ latitude, longitude, accuracy, speed });
          enviarPosicaoSupabase(latitude, longitude, accuracy, speed);
        },
        (geoErr) => {
          console.error('Erro no GPS:', geoErr);
          setErroGPS(
            geoErr.code === 1
              ? 'Permissão de localização negada. Ative o GPS nas configurações do aparelho.'
              : 'Sinal de GPS fraco ou indisponível.'
          );
          setIsRastreando(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      watchIdRef.current = id;
    }
  };

  // Limpa watchPosition ao desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Concluir entrega
  const handleFinalizarEntrega = async () => {
    try {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      const { error: updateErr } = await supabase
        .from('pedidos')
        .update({
          status: 'entregue',
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pedidoId);

      if (updateErr) throw updateErr;

      alert('🎉 Entrega concluída com sucesso! Parabéns pela corrida.');
      router.push('/admin/entregas');
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao finalizar';
      alert(`Erro ao finalizar entrega: ${errMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
        <p className="text-xs text-zinc-400 font-medium">Carregando painel de rota...</p>
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-lg font-bold text-red-400 mb-2">Pedido não encontrado</h1>
        <p className="text-xs text-zinc-400 mb-6 max-w-xs">{error}</p>
        <Link
          href="/admin/entregas"
          className="px-5 py-2.5 bg-[#F59E0B] text-black font-bold text-xs rounded-xl"
        >
          Voltar para Entregas
        </Link>
      </div>
    );
  }

  const enderecoCompleto = `${pedido.endereco_rua}, ${pedido.endereco_numero}, ${pedido.endereco_bairro}, Baixada Santista, SP`;
  const urlGoogleMaps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(enderecoCompleto)}`;
  const urlWaze = `https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}&navigate=yes`;
  const urlWhatsapp = `https://wa.me/55${pedido.cliente_whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Olá ${pedido.cliente_nome}! Sou o entregador da Teles Adega e estou a caminho com o seu pedido #${pedido.id.slice(0, 6)}.`
  )}`;

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white pb-12">
      {/* Top Mobile Bar */}
      <div className="sticky top-0 z-30 bg-[#161616]/95 backdrop-blur-md border-b border-[#262626] px-4 py-3 flex items-center justify-between">
        <Link
          href="/admin/entregas"
          className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-[#F59E0B]">
            #{pedido.id.slice(0, 6)}
          </span>
          <span
            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
              pedido.status === 'entregue'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
            }`}
          >
            {pedido.status === 'entregue' ? 'Entregue' : 'Em Rota'}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Motoboy Identity Selector */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 space-y-2">
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Identidade do Entregador:
          </label>
          <select
            value={selectedMotoboyId}
            onChange={(e) => setSelectedMotoboyId(e.target.value)}
            className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2 rounded-xl text-xs outline-none"
          >
            {motoboys.map((m) => (
              <option key={m.id} value={m.id}>
                🛵 {m.nome} ({m.telefone})
              </option>
            ))}
          </select>
        </div>

        {/* GPS Tracking Live Control */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isRastreando
                    ? 'bg-purple-500/20 text-[#8B5CF6] border border-[#8B5CF6]/40'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Radio className={`w-5 h-5 ${isRastreando ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">Transmissão de Rota (GPS)</h2>
                <p className="text-[11px] text-zinc-400">
                  {isRastreando ? 'Transmitindo a cada 5 segundos' : 'Transmissão pausada'}
                </p>
              </div>
            </div>

            <span
              className={`w-3 h-3 rounded-full ${
                isRastreando ? 'bg-emerald-500 animate-ping' : 'bg-zinc-600'
              }`}
            />
          </div>

          {/* Action Button: Start / Pause GPS */}
          <button
            type="button"
            onClick={handleToggleRastreamento}
            className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition ${
              isRastreando
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                : 'bg-[#8B5CF6] hover:bg-purple-600 text-white shadow-purple-500/20'
            }`}
          >
            {isRastreando ? (
              <>Pausar Compartilhamento de Localização</>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Iniciar Rota / Compartilhar Localização
              </>
            )}
          </button>

          {/* GPS Live Telemetry Info */}
          {isRastreando && gpsCoords && (
            <div className="bg-[#0D0D0D] border border-[#262626] rounded-xl p-3 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Latitude / Longitude:</span>
                <span className="text-white font-bold">
                  {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Precisão do GPS:</span>
                <span className="text-emerald-400 font-bold">
                  ±{Math.round(gpsCoords.accuracy || 0)} metros
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Último Envio:</span>
                <span className="text-[#F59E0B]">
                  {ultimoEnvioEm ? ultimoEnvioEm.toLocaleTimeString('pt-BR') : 'Enviando...'} (
                  {totalPingsEnviados} pings)
                </span>
              </div>
            </div>
          )}

          {erroGPS && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{erroGPS}</span>
            </div>
          )}
        </div>

        {/* Customer & Address Details */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-xs uppercase tracking-wider">
            <MapPin className="w-4 h-4" />
            Dados do Cliente & Destino
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-extrabold text-white text-sm">{pedido.cliente_nome}</p>
                <p className="text-zinc-300 font-medium">{pedido.endereco_rua}, Nº {pedido.endereco_numero}</p>
                <p className="text-zinc-400">Bairro: <strong className="text-white">{pedido.endereco_bairro}</strong></p>
                {pedido.endereco_complemento && (
                  <p className="text-zinc-400">Comp: {pedido.endereco_complemento}</p>
                )}
                {pedido.ponto_referencia && (
                  <p className="text-amber-400 font-semibold mt-1">
                    📍 Ref: {pedido.ponto_referencia}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Navigation Buttons (Google Maps / Waze / WhatsApp) */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <a
                href={urlGoogleMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-2 bg-[#0D0D0D] hover:bg-zinc-900 border border-[#262626] rounded-xl text-center flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-blue-400 transition"
              >
                <Navigation className="w-4 h-4" />
                Google Maps
              </a>

              <a
                href={urlWaze}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-2 bg-[#0D0D0D] hover:bg-zinc-900 border border-[#262626] rounded-xl text-center flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-cyan-400 transition"
              >
                <ExternalLink className="w-4 h-4" />
                Waze
              </a>

              <a
                href={urlWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-2 bg-[#22C55E]/15 hover:bg-[#22C55E]/25 border border-[#22C55E]/30 rounded-xl text-center flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#22C55E] transition"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Financial info & Change */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 flex items-center justify-between text-xs">
          <div>
            <span className="text-zinc-400 block text-[11px]">Cobrança na Entrega:</span>
            <span className="text-white font-extrabold uppercase">
              {pedido.forma_pagamento}
              {pedido.troco_para && ` (Troco p/ R$ ${Number(pedido.troco_para).toFixed(2)})`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-zinc-400 block text-[11px]">Valor Total:</span>
            <span className="text-[#F59E0B] font-black text-sm">
              R$ {Number(pedido.valor_total).toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* OTP Delivery Confirmation Code */}
        {pedido.status !== 'entregue' ? (
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Finalização da Corrida:
            </label>
            <CodeValidationInput
              pedidoId={pedido.id}
              codigoEsperado={pedido.codigo_entrega}
              onSuccess={handleFinalizarEntrega}
            />
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Pedido Entregue com Sucesso!</h3>
            <p className="text-xs text-zinc-400">O código de entrega foi autenticado e a corrida finalizada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
