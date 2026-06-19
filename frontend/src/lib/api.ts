const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'moim_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function googleLoginUrl(): string {
  return `${API_BASE}/api/auth/google`;
}

type ApiOptions = {
  method?: string;
  body?: unknown;
};

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || `요청 실패 (${res.status})`);
  }
  return data as T;
}
