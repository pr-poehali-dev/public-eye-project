import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi, Complaint, CATEGORIES, STATUS_CONFIG, getCategoryByValue, timeAgo } from '@/lib/api';
import ComplaintCard from '@/components/ComplaintCard';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const STATUS_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'resolved', label: 'Решено' },
  { value: 'rejected', label: 'Отклонено' },
];

// Simple interactive map using native HTML canvas (placeholder for Yandex Maps)
function MapView({ complaints, onMarkerClick }: { complaints: Complaint[]; onMarkerClick: (c: Complaint) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);

  // We use Yandex Maps via script injection
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('ymaps-script')) {
      const script = document.createElement('script');
      script.id = 'ymaps-script';
      script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const markerColor = (status: string) => {
    const colors: Record<string, string> = {
      new: '#F59E0B', in_progress: '#3B82F6', resolved: '#10B981', rejected: '#EF4444'
    };
    return colors[status] || '#94A3B8';
  };

  return (
    <div ref={mapRef} className="relative w-full h-full bg-gradient-to-br from-slate-100 to-blue-50 overflow-hidden">
      {/* Fake map background */}
      <div className="absolute inset-0">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="opacity-30">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        {/* Road lines */}
        <svg className="absolute inset-0 opacity-20" width="100%" height="100%">
          <line x1="0" y1="35%" x2="100%" y2="35%" stroke="#64748b" strokeWidth="8"/>
          <line x1="0" y1="65%" x2="100%" y2="65%" stroke="#64748b" strokeWidth="8"/>
          <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#64748b" strokeWidth="8"/>
          <line x1="70%" y1="0" x2="70%" y2="100%" stroke="#64748b" strokeWidth="8"/>
          <line x1="0" y1="35%" x2="100%" y2="35%" stroke="#e2e8f0" strokeWidth="2"/>
          <line x1="0" y1="65%" x2="100%" y2="65%" stroke="#e2e8f0" strokeWidth="2"/>
          <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#e2e8f0" strokeWidth="2"/>
          <line x1="70%" y1="0" x2="70%" y2="100%" stroke="#e2e8f0" strokeWidth="2"/>
        </svg>
      </div>

      {/* Map label */}
      <div className="absolute top-3 left-3 glass rounded-xl px-3 py-1.5 text-xs text-gray-600 flex items-center gap-2 shadow-sm">
        <Icon name="Map" size={14} className="text-blue-500" />
        Интерактивная карта жалоб
      </div>

      {/* Complaint markers */}
      {complaints.slice(0, 20).map((c, i) => {
        const x = ((c.lng || 37.6 + (i * 0.03)) % 1) * 100;
        const y = ((c.lat || 55.7 + (i * 0.02)) % 1) * 100;
        const adjustedX = 10 + (i * 37) % 80;
        const adjustedY = 15 + (i * 23) % 70;
        const color = markerColor(c.status);
        const cat = getCategoryByValue(c.category);
        return (
          <button
            key={c.id}
            onClick={() => onMarkerClick(c)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-10"
            style={{ left: `${adjustedX}%`, top: `${adjustedY}%` }}
          >
            <div className="relative">
              <div
                className="w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-lg transition-transform group-hover:scale-125"
                style={{ backgroundColor: color }}
              >
                {cat.icon}
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white" style={{ backgroundColor: color }} />
              {/* Tooltip */}
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl p-2 min-w-max opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-gray-100">
                <p className="text-xs font-semibold text-gray-900 max-w-[140px] truncate">{c.title}</p>
                <p className="text-xs text-gray-400">{timeAgo(c.created_at)}</p>
              </div>
            </div>
          </button>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass rounded-xl p-2 shadow-sm">
        <div className="flex flex-col gap-1">
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: val.color }} />
              <span className="text-xs text-gray-600">{val.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      params.limit = '50';
      const data = await complaintsApi.list(params);
      setComplaints(data.complaints);
      setTotal(data.total);
    } catch {
      toast.error('Не удалось загрузить жалобы');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  const handleMarkerClick = (c: Complaint) => {
    setSelectedComplaint(c);
  };

  return (
    <div className="flex flex-col h-screen pt-16">
      {/* Hero banner */}
      <div className="gradient-hero text-white px-4 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-montserrat mb-0.5">
              👁️ Глаз Народа
            </h1>
            <p className="text-blue-100 text-sm">
              {total} жалоб от жителей города
            </p>
          </div>
          <Button
            onClick={() => user ? navigate('/create') : navigate('/login')}
            className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-lg hover:shadow-xl transition-all flex-shrink-0"
          >
            <Icon name="Plus" size={18} className="mr-1" />
            Сообщить о проблеме
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setView('map')}
              className={`p-1.5 rounded-md transition-all ${view === 'map' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              <Icon name="Map" size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              <Icon name="List" size={16} />
            </button>
          </div>

          {/* Category filters */}
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              !categoryFilter ? 'gradient-primary text-white shadow-brand' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Все
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value === categoryFilter ? '' : cat.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                categoryFilter === cat.value
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={categoryFilter === cat.value ? { backgroundColor: cat.color } : {}}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Status filters */}
          {STATUS_FILTERS.filter(s => s.value).map(sf => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value === statusFilter ? '' : sf.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                statusFilter === sf.value
                  ? (STATUS_CONFIG[sf.value as keyof typeof STATUS_CONFIG]?.className || '')
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map (desktop: always visible; mobile: conditionally) */}
        {(view === 'map' || window.innerWidth >= 768) && (
          <div className={`${view === 'map' ? 'flex-1' : 'hidden md:flex md:flex-1'} relative`}>
            {loading ? (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Загружаем карту...</p>
                </div>
              </div>
            ) : (
              <MapView complaints={complaints} onMarkerClick={handleMarkerClick} />
            )}

            {/* Selected complaint popup */}
            {selectedComplaint && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 glass rounded-2xl shadow-xl border border-white/30 p-4 z-20">
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  <Icon name="X" size={16} />
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[selectedComplaint.status]?.className}`}>
                    {STATUS_CONFIG[selectedComplaint.status]?.label}
                  </span>
                  <span className="text-xs text-gray-400">{getCategoryByValue(selectedComplaint.category).icon} {getCategoryByValue(selectedComplaint.category).label}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{selectedComplaint.title}</h3>
                {selectedComplaint.address && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                    <Icon name="MapPin" size={12} /> {selectedComplaint.address}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Icon name="Heart" size={12} /> {selectedComplaint.supports_count} поддержек
                  </span>
                  <button
                    onClick={() => navigate(`/complaint/${selectedComplaint.id}`)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Подробнее <Icon name="ArrowRight" size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* List panel */}
        <div className={`${
          view === 'list' ? 'flex-1' : 'hidden md:flex md:w-80 lg:w-96'
        } flex-col bg-white border-l border-gray-100 overflow-hidden`}>
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Последние жалобы
              {!loading && <span className="ml-2 text-sm font-normal text-gray-400">({total})</span>}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 shimmer rounded-xl" />
                ))}
              </div>
            ) : complaints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                  <Icon name="MapPin" size={28} className="text-blue-400" />
                </div>
                <p className="font-medium text-gray-900 mb-1">Жалоб не найдено</p>
                <p className="text-sm text-gray-400">Попробуйте изменить фильтры</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {complaints.map(c => (
                  <ComplaintCard
                    key={c.id}
                    complaint={c}
                    compact
                    onUpdate={updated => setComplaints(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
