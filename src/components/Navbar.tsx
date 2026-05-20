import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const { user, logout, isAdmin, isModerator } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { to: '/', label: 'Карта', icon: 'Map' },
    { to: '/stats', label: 'Статистика', icon: 'BarChart3' },
    { to: '/rating', label: 'Рейтинг', icon: 'Trophy' },
    ...(isModerator ? [{ to: '/admin', label: 'Админ', icon: 'Shield' }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-brand group-hover:shadow-brand-lg transition-all duration-200">
              <span className="text-white text-lg">👁️</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg text-gradient font-montserrat">Глаз Народа</span>
              <div className="text-[10px] text-gray-400 leading-none">Гражданский контроль</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  location.pathname === link.to
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon name={link.icon as 'Map'} size={16} />
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/profile" className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-7 h-7 gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{user.name[0]?.toUpperCase()}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{user.name.split(' ')[0]}</span>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-red-500">
                  <Icon name="LogOut" size={16} />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-gray-600">Войти</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="gradient-primary text-white border-0 shadow-brand hover:shadow-brand-lg">
                    Регистрация
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Icon name={menuOpen ? 'X' : 'Menu'} size={20} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden py-2 pb-4 border-t border-gray-100 mt-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  location.pathname === link.to ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon name={link.icon as 'Map'} size={18} />
                {link.label}
              </Link>
            ))}
            {user && (
              <div className="mt-2 px-4 pt-2 border-t border-gray-100">
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm text-gray-700">
                  <Icon name="User" size={18} /> Профиль
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 py-2 text-sm text-red-500 w-full">
                  <Icon name="LogOut" size={18} /> Выйти
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
