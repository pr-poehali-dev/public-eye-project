import { useState, useEffect, useCallback } from 'react';
import { sheltersApi, Shelter, SHELTER_TYPES } from '@/lib/api';
import CityMap from '@/components/CityMap';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function shelterToFake(s: Shelter) {
  return {
    id: s.id,
    title: `${s.type_icon} ${s.title}${s.capacity ? ` · ${s.capacity} чел.` : ''}`,
    description: s.description || s.type_label,
    category: 'other' as const,
    status: s.verified ? 'resolved' as const : 'new' as const,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    supports_count: s.capacity || 0,
    is_spam: false,
    created_at: s.created_at,
    updated_at: s.created_at,
    photos: [] as string[],
    user_supported: false,
  };
}

function AddShelterModal({ lat, lng, onClose, onSaved }: {
  lat: number; lng: number;
  onClose: () => void;
  onSaved: (s: Shelter) => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Введите название'); return; }
    if (!type) { toast.error('Выберите тип'); return; }
    setSaving(true);
    try {
      const res = await sheltersApi.create({
        title: title.trim(), type,
        description: description.trim() || undefined,
        lat, lng,
        capacity: capacity ? parseInt(capacity) : undefined,
      });
      const typeInfo = SHELTER_TYPES.find(t => t.value === type)!;
      onSaved({
        id: res.id, title: title.trim(), type,
        type_label: typeInfo.label, type_icon: typeInfo.icon, type_color: typeInfo.color,
        description: description.trim() || undefined,
        lat, lng,
        capacity: capacity ? parseInt(capacity) : undefined,
        status: 'active', verified: false, created_at: new Date().toISOString(),
      });
      toast.success('Убежище добавлено!');
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-700 rounded-xl flex items-center justify-center text-sm">🛡️</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Добавить убежище</p>
              <p className="text-xs text-gray-400">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={18} /></button>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {SHELTER_TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 transition-all ${
                type === t.value ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300 bg-gray-50'
              }`}>
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="text-[10px] text-gray-600 leading-tight font-medium text-center">{t.label}</span>
            </button>
          ))}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Название (напр. Подвал ул. Ленина, 12)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-blue-400" />
        <input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Описание (необязательно)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-blue-400" />
        <input value={capacity} onChange={e => setCapacity(e.target.value)} type="number"
          placeholder="Вместимость, чел. (необязательно)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <Button onClick={handleSave} disabled={saving || !title.trim() || !type}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white border-0 rounded-xl h-11 font-semibold">
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Сохраняем...</>
            : <><Icon name="Shield" size={16} className="mr-2" />Добавить убежище</>}
        </Button>
      </div>
    </div>
  );
}

export default function Shelters() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickMode, setQuickMode] = useState(false);
  const [newPin, setNewPin] = useState<{ lat: number; lng: number } | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [view, setView] = useState<'map' | 'list'>('map');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sheltersApi.list();
      setShelters(data.shelters);
    } catch {
      toast.error('Не удалось загрузить убежища');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = typeFilter ? shelters.filter(s => s.type === typeFilter) : shelters;
  const fakeComplaints = filtered.map(shelterToFake);

  return (
    <div className="flex flex-col h-screen pt-16">
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-montserrat">🛡️ Убежища Самары</h1>
            <p className="text-blue-200 text-xs">{loading ? '...' : `${shelters.length} укрытий на карте`}</p>
          </div>
          <Button onClick={() => setQuickMode(m => !m)}
            className={`font-semibold shadow-lg flex-shrink-0 text-sm transition-all ${
              quickMode ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300' : 'bg-white text-blue-800 hover:bg-blue-50'
            }`}>
            <Icon name={quickMode ? 'MousePointer' : 'Plus'} size={16} className="mr-1" />
            {quickMode ? 'Тапните на карту...' : 'Добавить убежище'}
          </Button>
        </div>
      </div>

      {quickMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800 flex items-center justify-center gap-2">
          <Icon name="MousePointer" size={14} />
          Нажмите на место на карте
          <button onClick={() => setQuickMode(false)} className="ml-2 text-yellow-600 underline text-xs">Отмена</button>
        </div>
      )}

      {!quickMode && (
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-2 min-w-max">
            <div className="flex bg-gray-100 rounded-lg p-0.5 mr-1">
              <button onClick={() => setView('map')} className={`p-1.5 rounded-md transition-all ${view === 'map' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><Icon name="Map" size={15} /></button>
              <button onClick={() => setView('list')} className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><Icon name="List" size={15} /></button>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <button onClick={() => setTypeFilter('')}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap ${!typeFilter ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Все</button>
            {SHELTER_TYPES.map(t => (
              <button key={t.value} onClick={() => setTypeFilter(t.value === typeFilter ? '' : t.value)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap ${typeFilter === t.value ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={typeFilter === t.value ? { backgroundColor: t.color } : {}}>
                {t.icon}<span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className={`${view === 'list' ? 'hidden md:flex md:flex-1' : 'flex-1'} relative overflow-hidden`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <CityMap
              complaints={fakeComplaints}
              onMapClick={quickMode ? (lat, lng) => setNewPin({ lat, lng }) : undefined}
              clickable={quickMode}
              selectedLat={newPin?.lat}
              selectedLng={newPin?.lng}
              height="100%"
            />
          )}
          {newPin && (
            <AddShelterModal lat={newPin.lat} lng={newPin.lng}
              onClose={() => { setNewPin(null); setQuickMode(false); }}
              onSaved={s => { setShelters(prev => [s, ...prev]); setNewPin(null); setQuickMode(false); }} />
          )}
          {!quickMode && (
            <div className="absolute top-3 right-3 glass rounded-xl p-2.5 shadow-sm z-[999] hidden sm:block">
              <p className="text-xs font-semibold text-gray-600 mb-2">Типы укрытий</p>
              <div className="flex flex-col gap-1.5">
                {SHELTER_TYPES.map(t => (
                  <div key={t.value} className="flex items-center gap-2">
                    <span className="text-sm">{t.icon}</span>
                    <span className="text-xs text-gray-600">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`${view === 'list' ? 'flex-1' : 'hidden md:flex md:w-80 lg:w-96'} flex-col bg-white border-l border-gray-100 overflow-hidden`}>
          <div className="p-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Убежища{!loading && <span className="ml-2 font-normal text-gray-400">({filtered.length})</span>}</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <span className="text-4xl mb-3">🛡️</span>
                <p className="font-medium text-gray-900 mb-1 text-sm">Убежищ пока нет</p>
                <p className="text-xs text-gray-400 mb-4">Нажмите «Добавить убежище» и отметьте на карте</p>
                <Button onClick={() => setQuickMode(true)} size="sm" className="bg-blue-700 text-white border-0 rounded-xl">
                  <Icon name="Plus" size={14} className="mr-1" /> Добавить первое
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <div key={s.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: s.type_color + '20' }}>{s.type_icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-500">{s.type_label}</span>
                        {s.verified && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Проверено</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                      {s.address && <p className="text-xs text-gray-400 truncate">{s.address}</p>}
                      {s.capacity && <p className="text-xs text-blue-600 mt-0.5">👥 до {s.capacity} чел.</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
