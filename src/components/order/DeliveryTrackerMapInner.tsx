'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface DeliveryTrackerMapInnerProps {
  origem: {
    latitude: number;
    longitude: number;
    label: string;
  };
  destino: {
    latitude: number;
    longitude: number;
    label: string;
    endereco?: string;
  };
  motoboyPos: {
    latitude: number;
    longitude: number;
    nome?: string;
  } | null;
  sinalAtivo: boolean;
}

export default function DeliveryTrackerMapInner({
  origem,
  destino,
  motoboyPos,
  sinalAtivo,
}: DeliveryTrackerMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const motoboyMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Inicializa mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = motoboyPos
      ? [motoboyPos.latitude, motoboyPos.longitude]
      : [origem.latitude, origem.longitude];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Tiles do CartoDB Dark Matter / OpenStreetMap com visual Dark Moderno
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    ).addTo(map);

    // Adiciona controle de zoom no canto inferior direito
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Ícone da Adega (Origem)
    const adegaIcon = L.divIcon({
      className: 'custom-adega-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-[#F59E0B] text-black font-black flex items-center justify-center shadow-lg shadow-amber-500/40 border-2 border-[#0D0D0D]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
              <path d="M2 7h20"/>
            </svg>
          </div>
          <div class="absolute -bottom-5 whitespace-nowrap px-1.5 py-0.5 bg-[#161616]/90 border border-[#262626] rounded text-[10px] font-bold text-amber-400 shadow">
            ${origem.label}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([origem.latitude, origem.longitude], { icon: adegaIcon })
      .addTo(map)
      .bindPopup(`<b>${origem.label}</b><br/>Ponto de Partida da Teles Adega`);

    // Ícone do Cliente (Destino)
    const clienteIcon = L.divIcon({
      className: 'custom-cliente-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-[#22C55E] text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 border-2 border-[#0D0D0D]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="absolute -bottom-5 whitespace-nowrap px-1.5 py-0.5 bg-[#161616]/90 border border-[#262626] rounded text-[10px] font-bold text-emerald-400 shadow">
            ${destino.label}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([destino.latitude, destino.longitude], { icon: clienteIcon })
      .addTo(map)
      .bindPopup(`<b>Seu Endereço</b><br/>${destino.endereco || 'Destino da Entrega'}`);

    mapInstanceRef.current = map;

    // Ajusta o enquadramento inicial
    const points: [number, number][] = [
      [origem.latitude, origem.longitude],
      [destino.latitude, destino.longitude],
    ];
    if (motoboyPos) {
      points.push([motoboyPos.latitude, motoboyPos.longitude]);
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem, destino]);

  // Atualiza Marcador do Motoboy e Linha de Rota
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const motoboyIcon = L.divIcon({
      className: 'custom-motoboy-pin',
      html: `
        <div class="relative flex items-center justify-center">
          ${
            sinalAtivo
              ? '<div class="absolute w-12 h-12 rounded-full bg-[#8B5CF6]/30 radar-pulse pointer-events-none"></div>'
              : ''
          }
          <div class="w-10 h-10 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center shadow-xl shadow-purple-500/50 border-2 border-white transition-transform duration-500 z-20">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
          <div class="absolute -bottom-5 whitespace-nowrap px-1.5 py-0.5 bg-[#8B5CF6] text-white rounded text-[10px] font-black tracking-wide shadow-lg">
            ${motoboyPos?.nome || 'Entregador'}
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (motoboyPos) {
      const newLatLng = L.latLng(motoboyPos.latitude, motoboyPos.longitude);

      if (!motoboyMarkerRef.current) {
        motoboyMarkerRef.current = L.marker(newLatLng, {
          icon: motoboyIcon,
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup(`<b>${motoboyPos.nome || 'Motoboy'}</b><br/>Em deslocamento`);
      } else {
        motoboyMarkerRef.current.setLatLng(newLatLng);
        motoboyMarkerRef.current.setIcon(motoboyIcon);
      }

      // Atualiza linha conectando Motoboy -> Destino
      const rotaCoords: [number, number][] = [
        [motoboyPos.latitude, motoboyPos.longitude],
        [destino.latitude, destino.longitude],
      ];

      if (!polylineRef.current) {
        polylineRef.current = L.polyline(rotaCoords, {
          color: '#8B5CF6',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(rotaCoords);
      }
    } else {
      // Se não há motoboyPos, traça Origem -> Destino
      const rotaCoords: [number, number][] = [
        [origem.latitude, origem.longitude],
        [destino.latitude, destino.longitude],
      ];

      if (!polylineRef.current) {
        polylineRef.current = L.polyline(rotaCoords, {
          color: '#F59E0B',
          weight: 3,
          opacity: 0.6,
          dashArray: '6, 6',
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(rotaCoords);
      }
    }
  }, [motoboyPos, destino, origem, sinalAtivo]);

  return (
    <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden border border-[#262626] shadow-2xl bg-[#0D0D0D]">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
