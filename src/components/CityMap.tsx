import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Complaint, STATUS_CONFIG, getCategoryByValue } from '@/lib/api';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(color: string, emoji: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.06 27.94 0 18 0z"
        fill="${color}" filter="url(#shadow)"/>
      <circle cx="18" cy="18" r="11" fill="white" opacity="0.95"/>
      <text x="18" y="22" text-anchor="middle" font-size="13">${emoji}</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -46],
  });
}

interface CityMapProps {
  complaints?: Complaint[];
  onMarkerClick?: (c: Complaint) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedLat?: number;
  selectedLng?: number;
  clickable?: boolean;
  center?: [number, number];
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
  center = [55.7558, 37.6173],
  zoom = 11,
  height = '100%',
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (clickable && onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update complaint markers
  useEffect(() => {
    if (!markersRef.current || !mapRef.current) return;
    markersRef.current.clearLayers();

    complaints.forEach(c => {
      if (!c.lat || !c.lng) return;
      const cat = getCategoryByValue(c.category);
      const status = STATUS_CONFIG[c.status];
      const icon = makeIcon(status?.color || '#94A3B8', cat.icon);
      const marker = L.marker([c.lat, c.lng], { icon });

      marker.bindPopup(`
        <div style="min-width:200px;font-family:Inter,sans-serif">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="background:${status?.color}20;color:${status?.color};border:1px solid ${status?.color}40;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">
              ${status?.label}
            </span>
            <span style="font-size:12px;color:#6b7280">${cat.icon} ${cat.label}</span>
          </div>
          <p style="font-weight:600;font-size:14px;color:#111827;margin:0 0 4px">${c.title}</p>
          ${c.address ? `<p style="font-size:12px;color:#9ca3af;margin:0 0 8px">📍 ${c.address}</p>` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:12px;color:#ef4444">❤️ ${c.supports_count}</span>
            <a href="/complaint/${c.id}" style="font-size:12px;color:#2563eb;font-weight:500">Подробнее →</a>
          </div>
        </div>
      `, { maxWidth: 260 });

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(c));
      }

      markersRef.current?.addLayer(marker);
    });
  }, [complaints, onMarkerClick]);

  // Update selected point marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (selectedMarkerRef.current) {
      mapRef.current.removeLayer(selectedMarkerRef.current);
      selectedMarkerRef.current = null;
    }

    if (selectedLat && selectedLng) {
      const pinIcon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;
          background:linear-gradient(135deg,#1D4ED8,#3B82F6);
          border:3px solid white;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 4px 12px rgba(37,99,235,0.5)
        "></div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const m = L.marker([selectedLat, selectedLng], { icon: pinIcon })
        .addTo(mapRef.current)
        .bindPopup('📍 Выбранная точка')
        .openPopup();
      selectedMarkerRef.current = m;
      mapRef.current.setView([selectedLat, selectedLng], Math.max(mapRef.current.getZoom(), 15));
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
