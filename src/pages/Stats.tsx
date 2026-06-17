import { useState, useEffect } from 'react';
import { statsApi, StatsData, CATEGORIES } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import Icon from '@/components/ui/icon';

export default function Stats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.get().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Загружаем статистику...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const categoryChartData = data.categories.map(c => ({
    name: CATEGORIES.find(cat => cat.value === c.category)?.label || c.label,
    count: c.count,
    fill: CATEGORIES.find(cat => cat.value === c.category)?.color || '#94A3B8',
  }));

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-brand">
              <Icon name="BarChart3" size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient font-montserrat">Статистика города</h1>
              <p className="text-gray-500 text-sm">Аналитика городских проблем в реальном времени</p>
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Всего жалоб', value: data.total, icon: '📋', color: '#3B82F6', bg: '#EFF6FF' },
            { label: 'Решено', value: data.resolved, icon: '✅', color: '#10B981', bg: '#F0FDF4' },
            { label: 'В работе', value: data.in_progress, icon: '🔄', color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Новые', value: data.new, icon: '🆕', color: '#F97316', bg: '#FFF7ED' },
            { label: 'Отклонено', value: data.rejected, icon: '❌', color: '#EF4444', bg: '#FEF2F2' },
            { label: 'Граждан', value: data.users_total, icon: '👥', color: '#8B5CF6', bg: '#F5F3FF' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover text-center">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Resolve rate */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Процент решённых проблем</h3>
            <span className="text-3xl font-bold text-green-500">{data.resolve_rate}%</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
              style={{ width: `${data.resolve_rate}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">{data.resolved} из {data.total} жалоб решено</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Status pie chart */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Распределение по статусам</h3>
            {data.total > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={data.status_data.filter(s => s.count > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="count">
                      {data.status_data.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, data.status_data.find(s => s.count === value)?.label || name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {data.status_data.map(s => (
                    <div key={s.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-sm text-gray-600">{s.label}</span>
                      </div>
                      <span className="font-semibold text-sm">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">Нет данных</div>
            )}
          </div>

          {/* Category bar chart */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">По категориям</h3>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {categoryChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-400">Нет данных</div>
            )}
          </div>
        </div>

        {/* Monthly trend */}
        {data.monthly.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-4">
            <h3 className="font-semibold text-gray-900 mb-4">Динамика за 6 месяцев</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: '#2563EB', r: 5 }} name="Жалоб" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top complaints */}
        {data.top_complaints.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-4">
            <h3 className="font-semibold text-gray-900 mb-4">🔥 Самые популярные жалобы</h3>
            <div className="space-y-3">
              {data.top_complaints.slice(0, 5).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.address || 'Адрес не указан'}</p>
                  </div>
                  <div className="font-bold text-red-500 text-sm flex items-center gap-1">
                    <Icon name="Heart" size={12} className="fill-red-400" /> {c.supports_count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Районы Самары */}
        {data.districts && data.districts.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 gradient-primary rounded-xl flex items-center justify-center">
                <Icon name="MapPin" size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Жалобы по районам Самары</h3>
                <p className="text-xs text-gray-400">Определяется автоматически по координатам</p>
              </div>
            </div>
            <div className="space-y-3">
              {data.districts.filter(d => d.total > 0).map(d => {
                const maxTotal = Math.max(...data.districts.map(x => x.total), 1);
                const resolveRate = d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0;
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-sm font-medium text-gray-800">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="text-amber-600">🆕 {d.new}</span>
                        <span className="text-blue-600">🔄 {d.in_progress}</span>
                        <span className="text-green-600">✅ {d.resolved}</span>
                        <span className="font-semibold text-gray-700 w-6 text-right">{d.total}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(d.total / maxTotal) * 100}%`, backgroundColor: d.color }} />
                    </div>
                    {resolveRate > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">Решено {resolveRate}%</p>
                    )}
                  </div>
                );
              })}
              {data.districts.every(d => d.total === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Жалоб с координатами пока нет — добавляйте метки на карте
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}