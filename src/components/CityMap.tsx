import { useEffect, useRef } from 'react';
import { Complaint, STATUS_CONFIG, getCategoryByValue } from '@/lib/api';

const DGIS_KEY = 'e2881020-31cf-45d1-85dc-6e2524f9006f';
const DEFAULT_CENTER: [number, number] = [50.1457, 53.1959]; // [lng, lat] Самара

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

// Глобальный реестр коллбэков — HtmlMarker использует inline onclick
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markerCallbacks: Record<string, () => void> = (window as any).__mapMarkerCbs ??= {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadSdk(): Promise<any> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (document.getElementById('mapgl-sdk')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve((window as any).mapgl);
      return;
    }
    const script = document.createElement('script');
    script.id = 'mapgl-sdk';
    script.src = 'https://mapgl.2gis.com/api/js/v1';
    script.onload = () => resolve((window as any).mapgl); // eslint-disable-line @typescript-eslint/no-explicit-any
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

let cbCounter = 0;

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
  const mapglRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const markerCbKeysRef = useRef<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popupRef = useRef<any>(null);

  const dgisCenter: [number, number] = center ? [center[1], center[0]] : DEFAULT_CENTER;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    loadSdk().then((mapgl) => {
      if (destroyed || !containerRef.current || !mapgl) return;
      mapglRef.current = mapgl;

      const map = new mapgl.Map(containerRef.current, {
        center: dgisCenter,
        zoom,
        key: DGIS_KEY,
      });
      mapRef.current = map;
    });

    return () => {
      destroyed = true;
      markersRef.current.forEach(m => { try { m.destroy(); } catch { /**/ } });
      markersRef.current = [];
      markerCbKeysRef.current.forEach(k => delete markerCallbacks[k]);
      markerCbKeysRef.current = [];
      if (popupRef.current) { try { popupRef.current.destroy(); } catch { /**/ } popupRef.current = null; }
      if (selectedMarkerRef.current) { try { selectedMarkerRef.current.destroy(); } catch { /**/ } selectedMarkerRef.current = null; }
      if (mapRef.current) { try { mapRef.current.destroy(); } catch { /**/ } mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обработчик клика по карте — пересоздаём при смене clickable
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    const tryAttach = () => {
      if (!mapRef.current) { setTimeout(tryAttach, 200); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (e: any) => {
        if (!onMapClickRef.current) return;
        const coords = e.lngLat;
        if (Array.isArray(coords)) onMapClickRef.current(coords[1], coords[0]);
        else onMapClickRef.current(coords.lat ?? coords[1], coords.lng ?? coords[0]);
      };
      if (clickable) {
        mapRef.current.on('click', handler);
        return () => { try { mapRef.current?.off('click', handler); } catch { /**/ } };
      }
    };
    return tryAttach() ?? undefined;
  }, [clickable]);

  // Маркеры жалоб
  useEffect(() => {
    if (!mapRef.current || !mapglRef.current) return;
    const mapgl = mapglRef.current;

    // Чистим старые
    markersRef.current.forEach(m => { try { m.destroy(); } catch { /**/ } });
    markersRef.current = [];
    markerCbKeysRef.current.forEach(k => delete markerCallbacks[k]);
    markerCbKeysRef.current = [];
    if (popupRef.current) { try { popupRef.current.destroy(); } catch { /**/ } popupRef.current = null; }

    complaints.forEach(c => {
      if (!c.lat || !c.lng) return;
      const cat = getCategoryByValue(c.category);
      const status = STATUS_CONFIG[c.status];
      const color = status?.color || '#94A3B8';

      // Уникальный ключ для коллбэка
      const cbKey = `mc_${++cbCounter}`;
      markerCbKeysRef.current.push(cbKey);

      // Регистрируем коллбэк глобально
      markerCallbacks[cbKey] = () => {
        if (onMarkerClick) onMarkerClick(c);
        if (popupRef.current) { try { popupRef.current.destroy(); } catch { /**/ } popupRef.current = null; }
        popupRef.current = new mapgl.HtmlMarker(mapRef.current, {
          coordinates: [c.lng!, c.lat!],
          html: `<div style="background:white;border-radius:14px;padding:12px 14px;
              box-shadow:0 8px 24px rgba(0,0,0,0.15);min-width:210px;
              font-family:Inter,sans-serif;border:1px solid #f0f0f0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="background:${color}20;color:${color};border:1px solid ${color}40;
                padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${status?.label}</span>
              <span style="font-size:12px;color:#6b7280">${cat.icon} ${cat.label}</span>
            </div>
            <p style="font-weight:600;font-size:13px;color:#111827;margin:0 0 4px;line-height:1.3">${c.title}</p>
            ${c.address ? `<p style="font-size:11px;color:#9ca3af;margin:0 0 6px">📍 ${c.address}</p>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12px;color:#ef4444">❤️ ${c.supports_count}</span>
              <a href="/complaint/${c.id}" style="font-size:12px;color:#2563eb;font-weight:500;text-decoration:none">Подробнее →</a>
            </div></div>`,
          anchor: [0.5, 1.4],
        });
        setTimeout(() => {
          if (popupRef.current) { try { popupRef.current.destroy(); } catch { /**/ } popupRef.current = null; }
        }, 6000);
      };

      const marker = new mapgl.HtmlMarker(mapRef.current, {
        coordinates: [c.lng, c.lat],
        html: `<div
            onclick="window.__mapMarkerCbs['${cbKey}']()"
            style="cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));transition:transform .15s"
            onmouseenter="this.style.transform='scale(1.2)'"
            onmouseleave="this.style.transform='scale(1)'">
          <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
            <path d="M19 0C8.51 0 0 8.51 0 19c0 14.25 19 29 19 29S38 33.25 38 19C38 8.51 29.49 0 19 0z" fill="${color}"/>
            <circle cx="19" cy="19" r="12" fill="white" opacity="0.95"/>
            <text x="19" y="24" text-anchor="middle" font-size="14">${cat.icon}</text>
          </svg>
        </div>`,
        anchor: [0.5, 1],
      });

      markersRef.current.push(marker);
    });
  }, [complaints, onMarkerClick]);

  // Выбранная точка
  useEffect(() => {
    if (!mapRef.current || !mapglRef.current) return;
    const mapgl = mapglRef.current;
    if (selectedMarkerRef.current) { try { selectedMarkerRef.current.destroy(); } catch { /**/ } selectedMarkerRef.current = null; }
    if (selectedLat && selectedLng) {
      selectedMarkerRef.current = new mapgl.HtmlMarker(mapRef.current, {
        coordinates: [selectedLng, selectedLat],
        html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#1D4ED8,#3B82F6);
          border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
          box-shadow:0 4px 12px rgba(37,99,235,0.5)"></div>`,
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