import { Complaint, CATEGORIES, STATUS_CONFIG, timeAgo, getCategoryByValue, complaintsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface Props {
  complaint: Complaint;
  compact?: boolean;
  onUpdate?: (c: Complaint) => void;
}

export default function ComplaintCard({ complaint, compact = false, onUpdate }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [supported, setSupported] = useState(complaint.user_supported || false);
  const [supCount, setSupCount] = useState(complaint.supports_count);
  const [supporting, setSupporting] = useState(false);

  const cat = getCategoryByValue(complaint.category);
  const statusCfg = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.new;

  const handleSupport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    if (supporting) return;
    setSupporting(true);
    try {
      const res = await complaintsApi.support(complaint.id);
      setSupported(res.supported);
      setSupCount(res.supports_count);
      if (onUpdate) onUpdate({ ...complaint, supports_count: res.supports_count, user_supported: res.supported });
    } catch {
      toast.error('Не удалось поддержать жалобу');
    } finally {
      setSupporting(false);
    }
  };

  if (compact) {
    return (
      <div
        onClick={() => navigate(`/complaint/${complaint.id}`)}
        className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
          style={{ backgroundColor: cat.color + '20' }}
        >
          {cat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {complaint.title}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Icon name="Heart" size={12} />
              {supCount}
            </span>
            <span className="truncate">{complaint.address || 'Адрес не указан'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(`/complaint/${complaint.id}`)}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden card-hover cursor-pointer group"
    >
      {complaint.photos[0] && (
        <div className="h-40 overflow-hidden">
          <img src={complaint.photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ backgroundColor: cat.color + '20' }}
            >
              {cat.icon}
            </span>
            <span className="text-xs text-gray-500 font-medium">{cat.label}</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        </div>

        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {complaint.title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{complaint.description}</p>

        {complaint.address && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
            <Icon name="MapPin" size={12} />
            <span className="truncate">{complaint.address}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{timeAgo(complaint.created_at)}</span>
          <button
            onClick={handleSupport}
            disabled={supporting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              supported
                ? 'bg-red-50 text-red-500 border border-red-200'
                : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200'
            }`}
          >
            <Icon name="Heart" size={14} className={supported ? 'fill-red-400' : ''} />
            {supCount}
          </button>
        </div>
      </div>
    </div>
  );
}
