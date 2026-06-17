import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { complaintsApi, aiApi, Complaint, STATUS_CONFIG, getCategoryByValue, formatDate, timeAgo } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CityMap from '@/components/CityMap';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isModerator } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [supCount, setSupCount] = useState(0);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [appeal, setAppeal] = useState('');
  const [appealLoading, setAppealLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    complaintsApi.get(Number(id))
      .then(data => {
        setComplaint(data);
        setSupported(data.user_supported || false);
        setSupCount(data.supports_count);
      })
      .catch(() => toast.error('Жалоба не найдена'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSupport = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await complaintsApi.support(Number(id));
      setSupported(res.supported);
      setSupCount(res.supports_count);
      toast.success(res.supported ? 'Вы поддержали жалобу!' : 'Поддержка отменена');
    } catch { toast.error('Ошибка'); }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    if (!user) { navigate('/login'); return; }
    setCommenting(true);
    try {
      await complaintsApi.addComment(Number(id), comment);
      const updated = await complaintsApi.get(Number(id));
      setComplaint(updated);
      setComment('');
      toast.success('Комментарий добавлен');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setCommenting(false);
    }
  };

  const handleGenerateAppeal = async () => {
    if (!complaint) return;
    setAppealLoading(true);
    try {
      const res = await aiApi.generateAppeal(complaint.id);
      setAppeal(res.appeal);
    } catch { toast.error('Не удалось сформировать обращение'); }
    finally { setAppealLoading(false); }
  };

  const handleCopyAppeal = () => {
    navigator.clipboard.writeText(appeal);
    toast.success('Текст скопирован!');
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Загружаем жалобу...</p>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Жалоба не найдена</p>
          <Button onClick={() => navigate('/')} className="mt-4">На главную</Button>
        </div>
      </div>
    );
  }

  const cat = getCategoryByValue(complaint.category);
  const statusCfg = STATUS_CONFIG[complaint.status];

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-4 transition-colors text-sm">
          <Icon name="ArrowLeft" size={16} /> Назад
        </button>

        {/* Photos */}
        {complaint.photos.length > 0 && (
          <div className={`mb-4 grid gap-2 ${complaint.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {complaint.photos.map((photo, i) => (
              <div key={i} className="relative aspect-video overflow-hidden rounded-2xl cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                <img src={photo} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
            ))}
          </div>
        )}

        {/* Photo lightbox */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
            <img src={selectedPhoto} alt="" className="max-w-full max-h-full rounded-2xl" />
          </div>
        )}

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-sm text-gray-500 font-medium">{cat.label}</span>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusCfg?.className}`}>
                {statusCfg?.label}
              </span>
            </div>
            <span className="text-sm text-gray-400 whitespace-nowrap">#{complaint.id}</span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-3">{complaint.title}</h1>
          <p className="text-gray-600 leading-relaxed mb-4">{complaint.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-500">
            {complaint.address && (
              <div className="flex items-center gap-2">
                <Icon name="MapPin" size={15} className="text-blue-400" />
                <span>{complaint.address}</span>
              </div>
            )}
            {complaint.lat && complaint.lng && (
              <div className="flex items-center gap-2">
                <Icon name="Navigation" size={15} className="text-blue-400" />
                <span>{complaint.lat.toFixed(5)}, {complaint.lng.toFixed(5)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Icon name="Calendar" size={15} className="text-blue-400" />
              <span>{formatDate(complaint.created_at)}</span>
            </div>
            {complaint.author_name && (
              <div className="flex items-center gap-2">
                <Icon name="User" size={15} className="text-blue-400" />
                <span>{complaint.author_name}</span>
              </div>
            )}
          </div>

          {/* Map */}
          {complaint.lat && complaint.lng && (
            <div className="mt-4 rounded-2xl overflow-hidden border border-gray-100" style={{ height: 220 }}>
              <CityMap
                complaints={[complaint]}
                selectedLat={complaint.lat}
                selectedLng={complaint.lng}
                center={[complaint.lat, complaint.lng]}
                zoom={15}
                height="100%"
              />
            </div>
          )}

          {complaint.official_comment && (
            <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Shield" size={16} className="text-blue-600" />
                <span className="font-semibold text-blue-800 text-sm">Официальный ответ</span>
              </div>
              <p className="text-blue-700 text-sm">{complaint.official_comment}</p>
            </div>
          )}

          {/* Support button */}
          <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleSupport}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all ${
                supported
                  ? 'bg-red-50 text-red-500 border-2 border-red-200 hover:bg-red-100'
                  : 'gradient-primary text-white shadow-brand hover:shadow-brand-lg'
              }`}
            >
              <Icon name="Heart" size={18} className={supported ? 'fill-red-400' : ''} />
              {supported ? 'Поддержано' : 'Поддержать'}
            </button>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{supCount}</div>
              <div className="text-xs text-gray-400">поддержек</div>
            </div>
            <div className="ml-auto text-xs text-gray-400">
              Последнее обновление: {timeAgo(complaint.updated_at)}
            </div>
          </div>
        </div>

        {/* AI Appeal */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 gradient-primary rounded-xl flex items-center justify-center">
                <Icon name="FileText" size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">ИИ-помощник</h3>
                <p className="text-xs text-gray-400">Сформировать официальное обращение</p>
              </div>
            </div>
            <Button onClick={handleGenerateAppeal} disabled={appealLoading} size="sm"
              className="gradient-primary text-white border-0 rounded-xl shadow-brand">
              {appealLoading ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Создаём...
                </div>
              ) : 'Создать'}
            </Button>
          </div>
          {appeal && (
            <div className="mt-3">
              <div className="relative">
                <pre className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 whitespace-pre-wrap font-sans border border-gray-200 max-h-60 overflow-y-auto">
                  {appeal}
                </pre>
                <button
                  onClick={handleCopyAppeal}
                  className="absolute top-2 right-2 p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Icon name="Copy" size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="MessageCircle" size={18} className="text-blue-500" />
            Комментарии ({complaint.comments?.length || 0})
          </h3>

          <div className="space-y-3 mb-4">
            {(complaint.comments || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Пока нет комментариев. Будьте первым!</p>
            ) : (
              complaint.comments?.map(c => (
                <div key={c.id} className={`p-3 rounded-2xl ${c.is_official ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${c.is_official ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {c.author_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{c.author_name || 'Аноним'}</span>
                    {c.is_official && (
                      <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full flex items-center gap-1">
                        <Icon name="Shield" size={10} /> Официальный
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 pl-8">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {user ? (
            <form onSubmit={handleComment} className="flex gap-2">
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Ваш комментарий..."
                className="flex-1 rounded-xl border-gray-200 min-h-[80px] resize-none"
              />
              <div className="flex flex-col gap-2">
                <Button type="submit" disabled={commenting || !comment.trim()} size="sm"
                  className="gradient-primary text-white border-0 rounded-xl h-full px-4">
                  {commenting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="Send" size={16} />}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-3">
              <p className="text-sm text-gray-500 mb-2">Войдите, чтобы оставить комментарий</p>
              <Button onClick={() => navigate('/login')} size="sm" variant="outline" className="rounded-xl">Войти</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}