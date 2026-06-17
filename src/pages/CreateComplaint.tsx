import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi, uploadApi, CATEGORIES, CreateComplaintData } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CityMap from '@/components/CityMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

export default function CreateComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CreateComplaintData & { title: string; description: string; category: string }>({
    title: '', description: '', category: '', address: '', lat: undefined, lng: undefined, contact_info: '', photos: [],
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  if (!user) {
    navigate('/login');
    return null;
  }

  const set = (field: string, val: string | number | undefined) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) { toast.error('Максимум 5 фото'); return; }
    setUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} слишком большой (макс 5МБ)`); continue; }
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>(resolve => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        setPreviews(p => [...p, base64]);
        const res = await uploadApi.upload(base64);
        setPhotos(p => [...p, res.url]);
      } catch {
        toast.error('Не удалось загрузить фото');
      }
    }
    setUploading(false);
  };

  const removePhoto = (index: number) => {
    setPhotos(p => p.filter((_, i) => i !== index));
    setPreviews(p => p.filter((_, i) => i !== index));
  };

  const handleGeolocate = () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('lat', pos.coords.latitude);
        set('lng', pos.coords.longitude);
        toast.success('Геолокация определена');
      },
      () => toast.error('Не удалось определить геолокацию')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.category) {
      toast.error('Заполните обязательные поля');
      return;
    }
    setLoading(true);
    try {
      const data: CreateComplaintData = {
        title: form.title, description: form.description, category: form.category,
        address: form.address, lat: form.lat, lng: form.lng,
        contact_info: form.contact_info, photos,
      };
      const res = await complaintsApi.create(data);
      toast.success('Жалоба отправлена!');
      navigate(`/complaint/${res.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-4 transition-colors">
            <Icon name="ArrowLeft" size={16} /> Назад
          </button>
          <h1 className="text-2xl font-bold text-gradient font-montserrat">Сообщить о проблеме</h1>
          <p className="text-gray-500 text-sm mt-1">Ваше обращение поможет улучшить город</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s < step ? 'gradient-primary text-white' : s === step ? 'bg-blue-100 text-blue-600 border-2 border-blue-400' : 'bg-gray-100 text-gray-400'
              }`}>
                {s < step ? <Icon name="Check" size={14} /> : s}
              </div>
              <span className={`text-sm ${s === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {s === 1 ? 'Суть' : s === 2 ? 'Место' : 'Фото'}
              </span>
              {s < 3 && <div className={`flex-1 h-0.5 w-8 ${s < step ? 'bg-blue-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 space-y-5">
            {/* Step 1: Basic info */}
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Категория *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => set('category', cat.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          form.category === cat.value
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-gray-100 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-xs font-medium text-center leading-tight">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Краткое название *</label>
                  <Input
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="Например: Яма на дороге у д. 15"
                    className="h-11 rounded-xl border-gray-200"
                    maxLength={255}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.title.length}/255</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Подробное описание *</label>
                  <Textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Опишите проблему подробнее: что именно произошло, насколько опасно, как давно..."
                    className="rounded-xl border-gray-200 min-h-[120px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Контактные данные (необязательно)</label>
                  <Input
                    value={form.contact_info}
                    onChange={e => set('contact_info', e.target.value)}
                    placeholder="Телефон или email для обратной связи"
                    className="h-11 rounded-xl border-gray-200"
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    if (!form.title || !form.description || !form.category) { toast.error('Заполните обязательные поля'); return; }
                    setStep(2);
                  }}
                  className="w-full gradient-primary text-white border-0 h-11 rounded-xl font-semibold"
                >
                  Далее <Icon name="ArrowRight" size={16} className="ml-1" />
                </Button>
              </>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Адрес (текстом)</label>
                  <div className="relative">
                    <Icon name="MapPin" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={form.address}
                      onChange={e => set('address', e.target.value)}
                      placeholder="ул. Ленина, д. 15"
                      className="pl-9 h-11 rounded-xl border-gray-200"
                    />
                  </div>
                </div>

                {/* Interactive map */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Укажите место на карте
                    </label>
                    <Button
                      type="button"
                      onClick={handleGeolocate}
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 text-xs h-8"
                    >
                      <Icon name="Navigation" size={13} className="mr-1" />
                      Моё место
                    </Button>
                  </div>

                  <div className="rounded-2xl overflow-hidden border-2 border-dashed border-blue-200 h-64 relative">
                    <CityMap
                      clickable
                      onMapClick={(lat, lng) => {
                        set('lat', lat);
                        set('lng', lng);
                      }}
                      selectedLat={form.lat}
                      selectedLng={form.lng}
                      height="100%"
                    />
                  </div>

                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <Icon name="MousePointer" size={11} />
                    Нажмите на карту, чтобы поставить метку
                  </p>
                </div>

                {form.lat && form.lng ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                    <Icon name="CheckCircle" size={16} className="text-green-500" />
                    <span className="text-sm text-green-700">
                      Метка установлена: {(form.lat as number).toFixed(5)}, {(form.lng as number).toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={() => { set('lat', undefined); set('lng', undefined); }}
                      className="ml-auto text-gray-400 hover:text-red-400"
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <Icon name="AlertCircle" size={16} className="text-amber-500" />
                    <span className="text-sm text-amber-700">Место не выбрано — жалоба не появится на карте</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="button" onClick={() => setStep(1)} variant="outline" className="flex-1 h-11 rounded-xl">
                    <Icon name="ArrowLeft" size={16} className="mr-1" /> Назад
                  </Button>
                  <Button type="button" onClick={() => setStep(3)} className="flex-1 gradient-primary text-white border-0 h-11 rounded-xl font-semibold">
                    Далее <Icon name="ArrowRight" size={16} className="ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Photos + Submit */}
            {step === 3 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Фотографии (до 5 шт.)</label>
                  {previews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {previews.map((src, i) => (
                        <div key={i} className="relative aspect-square">
                          <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                          >
                            <Icon name="X" size={10} />
                          </button>
                          {i >= photos.length && (
                            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {previews.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all"
                    >
                      {uploading ? (
                        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="Camera" size={28} className="text-gray-400" />
                      )}
                      <span className="text-sm text-gray-500">
                        {uploading ? 'Загружаем...' : 'Нажмите для добавления фото'}
                      </span>
                      <span className="text-xs text-gray-400">JPG, PNG, WEBP до 5МБ</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Icon name="CheckCircle" size={16} /> Готово к отправке
                  </h3>
                  <div className="space-y-1 text-sm text-blue-700">
                    <p><span className="font-medium">Название:</span> {form.title}</p>
                    <p><span className="font-medium">Категория:</span> {CATEGORIES.find(c => c.value === form.category)?.label}</p>
                    {form.address && <p><span className="font-medium">Адрес:</span> {form.address}</p>}
                    {photos.length > 0 && <p><span className="font-medium">Фото:</span> {photos.length} шт.</p>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="button" onClick={() => setStep(2)} variant="outline" className="flex-1 h-11 rounded-xl">
                    <Icon name="ArrowLeft" size={16} className="mr-1" /> Назад
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || uploading}
                    className="flex-1 gradient-primary text-white border-0 h-11 rounded-xl font-semibold shadow-brand"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Отправляем...
                      </div>
                    ) : (
                      <><Icon name="Send" size={16} className="mr-1" /> Отправить</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}