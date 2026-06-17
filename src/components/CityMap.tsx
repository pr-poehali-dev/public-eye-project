import { useEffect, useRef } from 'react';
import { Complaint, STATUS_CONFIG, getCategoryByValue } from '@/lib/api';

const DGIS_KEY = 'e2881020-31cf-45d1-85dc-6e2524f9006f';

// Самара
const DEFAULT_CENTER: [number, number] = [50.1457, 53.1959]; // [lng, lat] — 2ГИС использует [lng, lat]

interface CityMapProps {
  complaints?: Complaint[];
  onMarkerClick?: (c: Complaint) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedLat?: number;
  selectedLng?: number;
  clickable?: boolean;
  center?: [number, number]; // [lat, lng] снаружи
  zoom?: number;
  height?: string;
}

export default function CityMap({
  complaints = [],
  onMarkerClick,
  onMapClick,
  selectedLat,
  selectedLng,
  clickable = false,
  center,
  zoom = 12,
  height = '100%',
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapglRef = useRef<any>(null);

  // Центр: снаружи передаётся [lat, lng], 2ГИС принимает [lng, lat]
  const dgisCenter = center
    ? [center[1], center[0]]
    : DEFAULT_CENTER;

  // Загружаем 2ГИС SDK и инициализируем карту
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let destroyed = false;

    async function init() {
       
      await loadMapgl();
      if (destroyed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapgl = (window as any).mapgl;
      mapglRef.current = mapgl;

      const map = new mapgl.Map(containerRef.current, {
        center: dgisCenter,
        zoom,
        key: DGIS_KEY,
      });

      mapRef.current = map;

      if (clickable && onMapClick) {
        map.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
          onMapClick(e.lngLat.lat, e.lngLat.lng);
        });
      }
    }

    init();

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  // Обновляем маркеры жалоб
  useEffect(() => {
    if (!mapRef.current || !mapglRef.current) return;
    const mapgl = mapglRef.current;

    markersRef.current.forEach(m => m.destroy());
    markersRef.current = [];

    complaints.forEach(c => {
      if (!c.lat || !c.lng) return;
      const cat = getCategoryByValue(c.category);
      const status = STATUS_CONFIG[c.status];
      const color = status?.color || '#94A3B8';

      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width:38px;height:48px;cursor:pointer;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          transition:transform 0.15s;
        " onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">
          <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
            <path d="M19 0C8.51 0 0 8.51 0 19c0 14.25 19 29 19 29S38 33.25 38 19C38 8.51 29.49 0 19 0z" fill="${color}"/>
            <circle cx="19" cy="19" r="12" fill="white" opacity="0.95"/>
            <text x="19" y="24" text-anchor="middle" font-size="14">${cat.icon}</text>
          </svg>
        </div>`;

      const marker = new mapgl.Marker(mapRef.current, {
        coordinates: [c.lng, c.lat],
        html: el.innerHTML,
        anchor: [0.5, 1],
      });

      marker.on('click', () => {
        if (onMarkerClick) onMarkerClick(c);

        // Показываем popup
        const popup = new mapgl.HtmlMarker(mapRef.current, {
          coordinates: [c.lng!, c.lat!],
          html: `
            <div style="
              background:white;border-radius:14px;padding:12px 14px;
              box-shadow:0 8px 24px rgba(0,0,0,0.15);
              min-width:210px;font-family:Inter,sans-serif;
              border:1px solid #f0f0f0;position:relative;
            ">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="background:${color}20;color:${color};border:1px solid ${color}40;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">
                  ${status?.label}
                </span>
                <span style="font-size:12px;color:#6b7280">${cat.icon} ${cat.label}</span>
              </div>
              <p style="font-weight:600;font-size:13px;color:#111827;margin:0 0 4px;line-height:1.3">${c.title}</p>
              ${c.address ? `<p style="font-size:11px;color:#9ca3af;margin:0 0 8px">📍 ${c.address}</p>` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
                <span style="font-size:12px;color:#ef4444">❤️ ${c.supports_count}</span>
                <a href="/complaint/${c.id}" style="font-size:12px;color:#2563eb;font-weight:500;text-decoration:none">
                  Подробнее →
                </a>
              </div>
            </div>`,
          anchor: [0.5, 1.3],
        });

        setTimeout(() => popup.destroy(), 5000);
      });

      markersRef.current.push(marker);
    });
  }, [complaints, onMarkerClick]);

  // Маркер выбранной точки
  useEffect(() => {
    if (!mapRef.current || !mapglRef.current) return;
    const mapgl = mapglRef.current;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.destroy();
      selectedMarkerRef.current = null;
    }

    if (selectedLat && selectedLng) {
      selectedMarkerRef.current = new mapgl.Marker(mapRef.current, {
        coordinates: [selectedLng, selectedLat],
        html: `<div style="
          width:28px;height:28px;
          background:linear-gradient(135deg,#1D4ED8,#3B82F6);
          border:3px solid white;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 4px 12px rgba(37,99,235,0.5);
        "></div>`,
        anchor: [0.5, 1],
      });

      mapRef.current.setCenter([selectedLng, selectedLat]);
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom(), 15));
    }
  }, [selectedLat, selectedLng]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className={clickable ? 'cursor-crosshair' : ''}
    />
  );
}

// Загружаем 2ГИС MapGL SDK один раз
function loadMapgl() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.__mapglPromise) return w.__mapglPromise;

  w.__mapglPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://mapgl.2gis.com/api/js/v1';
    script.onload = () => resolve(w.mapgl);
    document.head.appendChild(script);
  });

  return w.__mapglPromise;
}