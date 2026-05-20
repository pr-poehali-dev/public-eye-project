import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi, Complaint } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import ComplaintCard from '@/components/ComplaintCard';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'stats'>('my');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    complaintsApi.list({ user_id: user.id, limit: 50 })
      .then(data => setComplaints(data.complaints))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (!user) return null;

  const stats = {
    total: complaints.length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    in_progress: complaints.filter(c => c.status === 'in_progress').length,
    total_supports: complaints.reduce((s, c) => s + c.supports_count, 0),
  };

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Profile header */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-brand">
              {user.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
              <p className="text-gray-500 text-sm">{user.email}</p>
              {user.phone && <p className="text-gray-400 text-sm">{user.phone}</p>}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                  user.role === 'moderator' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {user.role === 'admin' ? '👑 Администратор' : user.role === 'moderator' ? '🛡️ Модератор' : '👤 Пользователь'}
                </span>
              </div>
            </div>
            <Button onClick={() => { logout(); navigate('/'); }} variant="ghost" size="sm" className="text-red-400 hover:text-red-500 hover:bg-red-50">
              <Icon name="LogOut" size={16} />
            </Button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-3 mt-6 pt-4 border-t border-gray-100">
            {[
              { label: 'Жалоб', value: stats.total, icon: '📋', color: 'blue' },
              { label: 'Решено', value: stats.resolved, icon: '✅', color: 'green' },
              { label: 'В работе', value: stats.in_progress, icon: '🔄', color: 'yellow' },
              { label: 'Поддержек', value: stats.total_supports, icon: '❤️', color: 'red' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-lg mb-0.5">{s.icon}</div>
                <div className="text-xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
          <button
            onClick={() => setTab('my')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'my' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
          >
            Мои жалобы
          </button>
          <button
            onClick={() => setTab('stats')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'stats' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
          >
            Активность
          </button>
        </div>

        {tab === 'my' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Мои жалобы ({stats.total})</h2>
              <Button onClick={() => navigate('/create')} size="sm" className="gradient-primary text-white border-0 rounded-xl shadow-brand">
                <Icon name="Plus" size={14} className="mr-1" /> Новая
              </Button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-28 shimmer rounded-2xl" />)}
              </div>
            ) : complaints.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon name="Plus" size={28} className="text-blue-400" />
                </div>
                <p className="font-medium text-gray-900 mb-1">Жалоб пока нет</p>
                <p className="text-sm text-gray-400 mb-4">Сообщите о проблеме в вашем городе</p>
                <Button onClick={() => navigate('/create')} className="gradient-primary text-white border-0 rounded-xl shadow-brand">
                  Создать первую жалобу
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {complaints.map(c => (
                  <ComplaintCard key={c.id} complaint={c} onUpdate={updated => setComplaints(prev => prev.map(x => x.id === updated.id ? updated : x))} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Ваша активность</h2>
            <div className="space-y-4">
              {[
                { label: 'Эффективность обращений', value: stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0, suffix: '%', color: '#10B981' },
                { label: 'В обработке', value: stats.total > 0 ? Math.round((stats.in_progress / stats.total) * 100) : 0, suffix: '%', color: '#3B82F6' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold" style={{ color: item.color }}>{item.value}{item.suffix}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 gradient-card rounded-2xl border border-blue-100">
              <p className="text-sm text-blue-700">
                <Icon name="Star" size={14} className="inline mr-1 text-yellow-500" />
                Спасибо за активное участие в улучшении города!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
