import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi, Complaint, CATEGORIES, STATUS_CONFIG, timeAgo } from '@/lib/api';
import ComplaintCard from '@/components/ComplaintCard';
import CityMap from '@/components/CityMap';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const STATUS_FILTERS = [
  { value: 'new', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'resolved', label: 'Решено' },
  { value: 'rejected', label: 'Отклонено' },
];

// Быстрая форма жалобы — появляется при тыке на карту
function QuickComplaintModal({
  lat, lng, onClose, onSaved,
}: {
  lat: number; lng: number;
  onClose: () => void;
  onSaved: (c: Complaint) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(true);

  useEffect(() => {
    const fetchAddress = async () => {
      try {
        const url = `https://catalog.api.2gis.com/3.0/items/geocode?lat=${lat}&lng=${lng}&fields=items.address_name,items.full_name&key=e2881020-31cf-45d1-85dc-6e2524f9006f`;
        const res = await fetch(url);
        const data = await res.json();
        const item = data?.result?.items?.[0];
        if (item) setAddress(item.address_name || item.full_name || '');
      } catch { /* адрес введут вручную */ }
      finally { setGeocoding(false); }
    };
    fetchAddress();
  }, [lat, lng]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Опишите проблему'); return; }
    if (!category) { toast.error('Выберите категорию'); return; }
    setSaving(true);
    try {
      const res = await complaintsApi.create({ title: title.trim(), description: title.trim(), category, lat, lng, address: address || undefined });
      const created = await complaintsApi.get(res.id);
      toast.success('Жалоба отправлена!');
      onSaved(created);
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-primary rounded-xl flex items-center justify-center">
              <Icon name="MapPin" size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Новая жалоба</p>
              {geocoding
                ? <p className="text-xs text-gray-400 flex items-center gap-1"><div className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin" /> Определяем адрес...</p>
                : <p className="text-xs text-gray-500 truncate max-w-[200px]">{address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Category chips */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 transition-all text-center ${
                category === cat.value
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-300 bg-gray-50'
              }`}
            >
              <span className="text-xl leading-none">{cat.icon}</span>
              <span className="text-[10px] text-gray-600 leading-tight font-medium">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Description */}
        <textarea
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Опишите проблему коротко..."
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-3"
          autoFocus
        />

        <Button
          onClick={handleSave}
          disabled={saving || !title.trim() || !category}
          className="w-full gradient-primary text-white border-0 rounded-xl h-11 font-semibold shadow-brand"
        >
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Отправляем...</>
            : <><Icon name="Send" size={16} className="mr-2" />Отправить жалобу</>
          }
        </Button>
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
  // Быстрая жалоба
  const [quickPin, setQuickPin] = useState<{ lat: number; lng: number } | null>(null);
  const [quickMode, setQuickMode] = useState(false);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
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

  const handleMapClick = (lat: number, lng: number) => {
    if (quickMode) {
      setQuickPin({ lat, lng });
      setSelectedComplaint(null);
    }
  };

  const handleComplaintSaved = (c: Complaint) => {
    setComplaints(prev => [c, ...prev]);
    setTotal(t => t + 1);
    setQuickPin(null);
    setQuickMode(false);
  };

  return (
    <div className="flex flex-col h-screen pt-16">
      {/* Hero banner */}
      <div className="gradient-hero text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-montserrat">👁️ Глаз Народа</h1>
            <p className="text-blue-100 text-xs">{loading ? '...' : `${total} жалоб на карте`}</p>
          </div>
          <Button
            onClick={() => setQuickMode(m => !m)}
            className={`font-semibold shadow-lg flex-shrink-0 text-sm transition-all ${
              quickMode
                ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'
                : 'bg-white text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Icon name={quickMode ? 'MousePointer' : 'Plus'} size={16} className="mr-1" />
            {quickMode ? 'Тапните на карту...' : 'Сообщить о проблеме'}
          </Button>
        </div>
      </div>

      {/* Подсказка режима */}
      {quickMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800 flex items-center justify-center gap-2">
          <Icon name="MousePointer" size={14} />
          Нажмите на нужное место на карте
          <button onClick={() => setQuickMode(false)} className="ml-2 text-yellow-600 hover:text-yellow-800 underline text-xs">
            Отмена
          </button>
        </div>
      )}

      {/* Filters */}
      {!quickMode && (
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-2 min-w-max">
            <div className="flex bg-gray-100 rounded-lg p-0.5 mr-1">
              <button onClick={() => setView('map')}
                className={`p-1.5 rounded-md transition-all ${view === 'map' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
                <Icon name="Map" size={15} />
              </button>
              <button onClick={() => setView('list')}
                className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
                <Icon name="List" size={15} />
              </button>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <button onClick={() => setCategoryFilter('')}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${!categoryFilter ? 'gradient-primary text-white shadow-brand' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Все
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat.value}
                onClick={() => setCategoryFilter(cat.value === categoryFilter ? '' : cat.value)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${categoryFilter === cat.value ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={categoryFilter === cat.value ? { backgroundColor: cat.color } : {}}>
                {cat.icon}<span className="hidden sm:inline">{cat.label}</span>
              </button>
            ))}
            <div className="w-px h-5 bg-gray-200" />
            {STATUS_FILTERS.map(sf => (
              <button key={sf.value}
                onClick={() => setStatusFilter(sf.value === statusFilter ? '' : sf.value)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${statusFilter === sf.value ? (STATUS_CONFIG[sf.value as keyof typeof STATUS_CONFIG]?.className || '') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {sf.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className={`${view === 'list' ? 'hidden md:flex md:flex-1' : 'flex-1'} relative overflow-hidden`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Загружаем карту...</p>
              </div>
            </div>
          ) : (
            <CityMap
              complaints={complaints}
              onMarkerClick={c => { if (!quickMode) { setSelectedComplaint(c); }}}
              onMapClick={handleMapClick}
              clickable={quickMode}
              selectedLat={quickPin?.lat}
              selectedLng={quickPin?.lng}
              height="100%"
            />
          )}

          {/* Quick complaint modal */}
          {quickPin && (
            <QuickComplaintModal
              lat={quickPin.lat}
              lng={quickPin.lng}
              onClose={() => { setQuickPin(null); setQuickMode(false); }}
              onSaved={handleComplaintSaved}
            />
          )}

          {/* Selected complaint popup */}
          {selectedComplaint && !quickMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] glass rounded-2xl shadow-xl border border-white/30 p-4 z-[1000]">
              <button onClick={() => setSelectedComplaint(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-white/80 rounded-full p-0.5">
                <Icon name="X" size={14} />
              </button>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[selectedComplaint.status]?.className}`}>
                  {STATUS_CONFIG[selectedComplaint.status]?.label}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 pr-6">{selectedComplaint.title}</h3>
              {selectedComplaint.address && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                  <Icon name="MapPin" size={11} /> {selectedComplaint.address}
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Icon name="Heart" size={11} /> {selectedComplaint.supports_count}</span>
                  <span>{timeAgo(selectedComplaint.created_at)}</span>
                </div>
                <button onClick={() => navigate(`/complaint/${selectedComplaint.id}`)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  Открыть <Icon name="ArrowRight" size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
          {!quickMode && (
            <div className="absolute top-3 right-3 glass rounded-xl p-2.5 shadow-sm z-[999] hidden sm:block">
              <div className="flex flex-col gap-1.5">
                {Object.entries(STATUS_CONFIG).map(([, val]) => (
                  <div key={val.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: val.color }} />
                    <span className="text-xs text-gray-600">{val.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* List panel */}
        <div className={`${view === 'list' ? 'flex-1' : 'hidden md:flex md:w-80 lg:w-96'} flex-col bg-white border-l border-gray-100 overflow-hidden`}>
          <div className="p-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              Жалобы{!loading && <span className="ml-2 font-normal text-gray-400">({total})</span>}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)}
              </div>
            ) : complaints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                  <Icon name="MapPin" size={24} className="text-blue-400" />
                </div>
                <p className="font-medium text-gray-900 mb-1 text-sm">Жалоб не найдено</p>
                <p className="text-xs text-gray-400">Попробуйте изменить фильтры</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {complaints.map(c => (
                  <ComplaintCard key={c.id} complaint={c}
                    onUpdate={updated => setComplaints(prev => prev.map(x => x.id === updated.id ? updated : x))}
                    compact />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}