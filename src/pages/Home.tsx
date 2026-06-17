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
            onClick={() => user ? navigate('/create') : navigate('/login')}
            className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-lg flex-shrink-0 text-sm"
          >
            <Icon name="Plus" size={16} className="mr-1" />
            Сообщить о проблеме
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 overflow-x-auto flex-shrink-0">
        <div className="flex items-center gap-2 min-w-max">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 mr-1">
            <button
              onClick={() => setView('map')}
              className={`p-1.5 rounded-md transition-all ${view === 'map' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              <Icon name="Map" size={15} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              <Icon name="List" size={15} />
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200" />

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
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                categoryFilter === cat.value ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={categoryFilter === cat.value ? { backgroundColor: cat.color } : {}}
            >
              {cat.icon}
              <span className="hidden sm:inline">{cat.label}</span>
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200" />

          {/* Status filters */}
          {STATUS_FILTERS.map(sf => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value === statusFilter ? '' : sf.value)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
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
              onMarkerClick={c => setSelectedComplaint(c)}
              height="100%"
            />
          )}

          {/* Selected complaint popup */}
          {selectedComplaint && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] glass rounded-2xl shadow-xl border border-white/30 p-4 z-[1000]">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-white/80 rounded-full p-0.5"
              >
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
                <button
                  onClick={() => navigate(`/complaint/${selectedComplaint.id}`)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Открыть <Icon name="ArrowRight" size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
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
        </div>

        {/* List panel */}
        <div className={`${
          view === 'list' ? 'flex-1' : 'hidden md:flex md:w-80 lg:w-96'
        } flex-col bg-white border-l border-gray-100 overflow-hidden`}>
          <div className="p-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              Жалобы
              {!loading && <span className="ml-2 text-sm font-normal text-gray-400">({total})</span>}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 shimmer rounded-xl" />
                ))}
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
