import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const set = (field: string, val: string) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error('Заполните обязательные поля'); return; }
    if (form.password.length < 6) { toast.error('Пароль минимум 6 символов'); return; }
    if (form.password !== form.confirm) { toast.error('Пароли не совпадают'); return; }
    setLoading(true);
    try {
      const res = await authApi.register({ name: form.name, email: form.email, password: form.password, phone: form.phone });
      login(res.token, res.user);
      toast.success('Аккаунт создан! Добро пожаловать!');
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-brand-lg animate-float">
            <span className="text-3xl">👁️</span>
          </div>
          <h1 className="text-2xl font-bold text-gradient font-montserrat">Создать аккаунт</h1>
          <p className="text-gray-500 mt-1 text-sm">Присоединяйтесь к сообществу активных граждан</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Имя *</label>
              <div className="relative">
                <Icon name="User" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Иван Иванов"
                  className="pl-9 h-11 rounded-xl border-gray-200" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
              <div className="relative">
                <Icon name="Mail" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.ru"
                  className="pl-9 h-11 rounded-xl border-gray-200" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон (необязательно)</label>
              <div className="relative">
                <Icon name="Phone" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 (999) 000-00-00"
                  className="pl-9 h-11 rounded-xl border-gray-200" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль *</label>
              <div className="relative">
                <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder="Минимум 6 символов" className="pl-9 pr-10 h-11 rounded-xl border-gray-200" required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icon name={showPass ? 'EyeOff' : 'Eye'} size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Подтвердите пароль *</label>
              <div className="relative">
                <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type={showPass ? 'text' : 'password'} value={form.confirm} onChange={e => set('confirm', e.target.value)}
                  placeholder="Повторите пароль" className="pl-9 h-11 rounded-xl border-gray-200" required />
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-11 gradient-primary text-white border-0 rounded-xl font-semibold shadow-brand hover:shadow-brand-lg mt-2">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Создаём аккаунт...
                </div>
              ) : 'Зарегистрироваться'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">Войти</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
