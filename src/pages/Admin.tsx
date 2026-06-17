import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi, Complaint, CATEGORIES, STATUS_CONFIG, getCategoryByValue, formatDate } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const STATUSES = [
  { value: '', label: 'Все статусы' },
  { value: 'new', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'resolved', label: 'Решено' },
  { value: 'rejected', label: 'Отклонено' },
];

export default function Admin() {
  const { user, isModerator } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [officialComment, setOfficialComment] = useState('');
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  useEffect(() => {
    if (!user || !isModerator) { navigate('/'); return; }
  }, [user, isModerator, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: PER_PAGE, offset: page * PER_PAGE };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const data = await complaintsApi.list(params);
      setComplaints(data.complaints);
      setTotal(data.total);
    } catch { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }, [statusFilter, categoryFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleSelect = (c: Complaint) => {
    setSelected(c);
    setNewStatus(c.status);
    setOfficialComment(c.official_comment || '');
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      await complaintsApi.updateStatus(selected.id, { status: newStatus, official_comment: officialComment });
      toast.success('Жалоба обновлена');
      setSelected(null);
      load();
    } catch { toast.error('Ошибка обновления'); }
    finally { setUpdating(false); }
  };

  const handleMarkSpam = async (c: Complaint) => {
    if (!confirm('Пометить как спам?')) return;
    try {
      await complaintsApi.updateStatus(c.id, { is_spam: true });
      toast.success('Помечено как спам');
      load();
    } catch { toast.error('Ошибка'); }
  };

  const handleDelete = async (c: Complaint) => {
    if (!confirm(`Удалить жалобу #${c.id} «${c.title}»?\n\nЭто действие нельзя отменить.`)) return;
    try {
      await complaintsApi.delete(c.id);
      toast.success('Жалоба удалена');
      if (selected?.id === c.id) setSelected(null);
      load();
    } catch { toast.error('Ошибка удаления'); }
  };

  if (!user || !isModerator) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-brand">
            <Icon name="Shield" size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient font-montserrat">Панель управления</h1>
            <p className="text-sm text-gray-500">Модерация жалоб · {total} записей</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3">
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => { setStatusFilter(s.value); setPage(0); }}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === s.value
                    ? 'gradient-primary text-white shadow-brand'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => { setCategoryFilter(''); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${!categoryFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Все категории
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => { setCategoryFilter(cat.value === categoryFilter ? '' : cat.value); setPage(0); }}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${categoryFilter === cat.value ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                style={categoryFilter === cat.value ? { backgroundColor: cat.color } : {}}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          {/* Table */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Жалоба</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Категория</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Поддержки</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Дата</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {complaints.map(c => {
                          const cat = getCategoryByValue(c.category);
                          const statusCfg = STATUS_CONFIG[c.status];
                          return (
                            <tr key={c.id} className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-blue-50' : ''}`} onClick={() => handleSelect(c)}>
                              <td className="py-3 px-4 text-sm text-gray-400">#{c.id}</td>
                              <td className="py-3 px-4">
                                <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{c.title}</p>
                                {c.address && <p className="text-xs text-gray-400 truncate max-w-[200px]">{c.address}</p>}
                              </td>
                              <td className="py-3 px-4">
                                <span className="flex items-center gap-1 text-sm">
                                  {cat.icon} <span className="text-xs text-gray-600 hidden sm:inline">{cat.label}</span>
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusCfg?.className}`}>
                                  {statusCfg?.label}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm font-medium text-red-500 flex items-center gap-1">
                                  <Icon name="Heart" size={12} className="fill-red-300" /> {c.supports_count}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">
                                {formatDate(c.created_at)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={e => { e.stopPropagation(); handleMarkSpam(c); }}
                                    className="text-xs text-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1"
                                  >
                                    <Icon name="AlertTriangle" size={12} /> Спам
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDelete(c); }}
                                    className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                                  >
                                    <Icon name="Trash2" size={12} /> Удалить
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <p className="text-sm text-gray-400">
                      {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} из {total}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-xl">
                        <Icon name="ChevronLeft" size={14} />
                      </Button>
                      <Button size="sm" variant="outline" disabled={(page + 1) * PER_PAGE >= total} onClick={() => setPage(p => p + 1)} className="rounded-xl">
                        <Icon name="ChevronRight" size={14} />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Edit panel */}
          {selected && (
            <div className="w-72 flex-shrink-0">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 sticky top-20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Редактировать #{selected.id}</h3>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                    <Icon name="X" size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-700 mb-4 line-clamp-3 bg-gray-50 rounded-xl p-3">{selected.title}</p>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Изменить статус</label>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setNewStatus(key)}
                        className={`py-2 px-2 rounded-xl text-xs font-medium transition-all ${newStatus === key ? val.className : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {val.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Официальный комментарий</label>
                  <Textarea
                    value={officialComment}
                    onChange={e => setOfficialComment(e.target.value)}
                    placeholder="Официальный ответ администрации..."
                    className="rounded-xl border-gray-200 text-sm min-h-[100px]"
                  />
                </div>

                <div className="flex gap-2 mb-2">
                  <Button onClick={() => navigate(`/complaint/${selected.id}`)} variant="outline" size="sm" className="flex-1 rounded-xl text-xs">
                    Открыть
                  </Button>
                  <Button onClick={handleUpdate} disabled={updating} size="sm" className="flex-1 gradient-primary text-white border-0 rounded-xl text-xs">
                    {updating ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Сохранить'}
                  </Button>
                </div>
                <Button
                  onClick={() => handleDelete(selected)}
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl text-xs text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  <Icon name="Trash2" size={13} className="mr-1" /> Удалить жалобу навсегда
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}