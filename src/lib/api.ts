export const API = {
  auth: 'https://functions.poehali.dev/e509b83c-df05-4164-b599-38a60901d449',
  complaints: 'https://functions.poehali.dev/9d69672e-855d-4241-b6b8-719e3dd384b2',
  stats: 'https://functions.poehali.dev/004f5796-0c79-4f8f-a906-e967f14288d9',
  upload: 'https://functions.poehali.dev/8c16937e-f013-427d-972b-f67730009c3f',
  aiAppeal: 'https://functions.poehali.dev/1be75732-bd70-4ad9-bbc0-cba584fcb955',
};

function getToken(): string | null {
  return localStorage.getItem('gn_token');
}

function getHeaders(withAuth = false): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

async function req<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, options);
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { /* keep as string */ }
  }
  if (!res.ok) {
    const err = (data as Record<string, string>)?.error || 'Ошибка запроса';
    throw new Error(err);
  }
  return data as T;
}

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    req<{ token: string; user: User }>(`${API.auth}/register`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    req<{ token: string; user: User }>(`${API.auth}/login`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    }),
  me: () =>
    req<{ user: User }>(`${API.auth}/me`, {
      method: 'GET', headers: getHeaders(true),
    }),
};

// Complaints
export const complaintsApi = {
  list: (params?: Record<string, string | number>) => {
    const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return req<{ complaints: Complaint[]; total: number }>(`${API.complaints}${q}`, {
      method: 'GET', headers: getHeaders(true),
    });
  },
  get: (id: number) =>
    req<Complaint>(`${API.complaints}?id=${id}`, {
      method: 'GET', headers: getHeaders(true),
    }),
  create: (data: CreateComplaintData) =>
    req<{ id: number; message: string }>(`${API.complaints}`, {
      method: 'POST', headers: getHeaders(true), body: JSON.stringify(data),
    }),
  updateStatus: (id: number, data: { status?: string; official_comment?: string; is_spam?: boolean }) =>
    req<{ message: string }>(`${API.complaints}?id=${id}&action=status`, {
      method: 'PATCH', headers: getHeaders(true), body: JSON.stringify(data),
    }),
  support: (id: number) =>
    req<{ supported: boolean; supports_count: number }>(`${API.complaints}?id=${id}&action=support`, {
      method: 'POST', headers: getHeaders(true), body: '{}',
    }),
  addComment: (id: number, text: string, is_official = false) =>
    req<{ id: number; created_at: string }>(`${API.complaints}?id=${id}&action=comments`, {
      method: 'POST', headers: getHeaders(true), body: JSON.stringify({ text, is_official }),
    }),
};

// Stats
export const statsApi = {
  get: () => req<StatsData>(`${API.stats}`, { method: 'GET', headers: getHeaders() }),
};

// Upload
export const uploadApi = {
  upload: (image: string) =>
    req<{ url: string }>(`${API.upload}`, {
      method: 'POST', headers: getHeaders(true), body: JSON.stringify({ image }),
    }),
};

// AI Appeal
export const aiApi = {
  generateAppeal: (complaintId?: number, complaint?: Partial<Complaint>) =>
    req<{ appeal: string; recipient: string }>(`${API.aiAppeal}`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ complaint_id: complaintId, complaint }),
    }),
};

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: 'user' | 'moderator' | 'admin';
  avatar_url?: string;
  created_at?: string;
}

export interface Complaint {
  id: number;
  user_id?: number;
  title: string;
  description: string;
  category: string;
  status: 'new' | 'in_progress' | 'resolved' | 'rejected';
  address?: string;
  lat?: number;
  lng?: number;
  contact_info?: string;
  official_comment?: string;
  supports_count: number;
  is_spam: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
  photos: string[];
  comments?: Comment[];
  user_supported?: boolean;
}

export interface Comment {
  id: number;
  text: string;
  is_official: boolean;
  created_at: string;
  author_name?: string;
}

export interface CreateComplaintData {
  title: string;
  description: string;
  category: string;
  address?: string;
  lat?: number;
  lng?: number;
  contact_info?: string;
  photos?: string[];
}

export interface StatsData {
  total: number;
  resolved: number;
  in_progress: number;
  new: number;
  rejected: number;
  users_total: number;
  resolve_rate: number;
  categories: { category: string; label: string; count: number }[];
  top_complaints: Complaint[];
  monthly: { month: string; count: number }[];
  status_data: { status: string; label: string; count: number; color: string }[];
}

export const CATEGORIES = [
  { value: 'roads', label: 'Дороги', icon: '🛣️', color: '#EF4444' },
  { value: 'garbage', label: 'Мусор', icon: '🗑️', color: '#6B7280' },
  { value: 'utilities', label: 'ЖКХ', icon: '🔧', color: '#F97316' },
  { value: 'traffic_lights', label: 'Светофоры', icon: '🚦', color: '#F59E0B' },
  { value: 'signs', label: 'Знаки', icon: '🛑', color: '#8B5CF6' },
  { value: 'lighting', label: 'Освещение', icon: '💡', color: '#06B6D4' },
  { value: 'landscaping', label: 'Благоустройство', icon: '🌳', color: '#10B981' },
  { value: 'other', label: 'Другое', icon: '📋', color: '#94A3B8' },
];

export const STATUS_CONFIG = {
  new: { label: 'Новая', color: '#F59E0B', bg: '#FEF3C7', className: 'status-new' },
  in_progress: { label: 'В работе', color: '#3B82F6', bg: '#DBEAFE', className: 'status-in_progress' },
  resolved: { label: 'Решено', color: '#10B981', bg: '#D1FAE5', className: 'status-resolved' },
  rejected: { label: 'Отклонено', color: '#EF4444', bg: '#FEE2E2', className: 'status-rejected' },
};

export function getCategoryByValue(value: string) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} д. назад`;
  return formatDate(dateStr);
}