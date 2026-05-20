import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi, Complaint, CATEGORIES, STATUS_CONFIG, getCategoryByValue, timeAgo } from '@/lib/api';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

type SortBy = 'supports' | 'new' | 'critical';

export default function Rating() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('supports');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    complaintsApi.list({ limit: 100 })
      .then(data => setComplaints(data.complaints))
      .catch(() => toast.error('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...complaints]
    .filter(c => !categoryFilter || c.category === categoryFilter)
    .sort((a, b) => {
      if (sortBy === 'supports') return b.supports_count - a.supports_count;
      if (sortBy === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'critical') return (b.supports_count * (b.status === 'new' ? 2 : 1)) - (a.supports_count * (a.status === 'new' ? 2 : 1));
      return 0;
    })
    .slice(0, 50);

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-brand">
              <Icon name="Trophy" size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient font-montserrat">Рейтинг проблем</h1>
              <p className="text-gray-500 text-sm">Самые актуальные городские проблемы</p>
            </div>
          </div>
        </div>

        {/* Sort + Filter */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Сортировка</p>
              <div className="flex gap-1">
                {[
                  { value: 'supports', label: '❤️ По поддержкам' },
                  { value: 'new', label: '🆕 По дате' },
                  { value: 'critical', label: '🔥 Критичные' },
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSortBy(s.value as SortBy)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      sortBy === s.value ? 'gradient-primary text-white shadow-brand' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Категория</p>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${!categoryFilter ? 'gradient-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Все
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(cat.value === categoryFilter ? '' : cat.value)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      categoryFilter === cat.value ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={categoryFilter === cat.value ? { backgroundColor: cat.color } : {}}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rankings */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🏆</div>
            <p className="font-medium text-gray-900">Жалоб пока нет</p>
            <p className="text-sm text-gray-400 mt-1">Будьте первым — сообщите о проблеме</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((c, i) => {
              const cat = getCategoryByValue(c.category);
              const statusCfg = STATUS_CONFIG[c.status];
              const isTop3 = i < 3;
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/complaint/${c.id}`)}
                  className={`bg-white rounded-2xl border cursor-pointer card-hover overflow-hidden ${
                    i === 0 ? 'border-yellow-200 shadow-md' :
                    i === 1 ? 'border-gray-200 shadow-sm' :
                    i === 2 ? 'border-orange-200 shadow-sm' :
                    'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500 text-sm'
                    }`}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i + 1}`}
                    </div>

                    {/* Photo */}
                    {c.photos[0] && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={c.photos[0]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: cat.color + '20' }}
                        >
                          {cat.icon}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg?.className}`}>
                          {statusCfg?.label}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">{c.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {c.address && <span className="flex items-center gap-1"><Icon name="MapPin" size={10} />{c.address}</span>}
                        <span>{timeAgo(c.created_at)}</span>
                      </div>
                    </div>

                    {/* Supports */}
                    <div className="text-center flex-shrink-0">
                      <div className={`text-2xl font-bold ${isTop3 ? 'text-red-500' : 'text-gray-700'}`}>
                        {c.supports_count}
                      </div>
                      <div className="flex items-center justify-center gap-0.5 text-xs text-gray-400">
                        <Icon name="Heart" size={10} className={isTop3 ? 'fill-red-400 text-red-400' : ''} />
                        голосов
                      </div>
                    </div>
                  </div>

                  {/* Progress bar for top items */}
                  {isTop3 && sorted[0]?.supports_count > 0 && (
                    <div className="h-1 bg-gray-100">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(c.supports_count / sorted[0].supports_count) * 100}%`,
                          backgroundColor: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : '#F97316'
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
