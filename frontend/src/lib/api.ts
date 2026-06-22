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

/**
 * 다른 창(로그인 팝업)에서 토큰이 저장되면 콜백 실행. 정리 함수 반환.
 * localStorage 는 동일 출처 창끼리 공유되고, setItem 시 다른 창에 storage 이벤트가
 * 발생하므로 window.opener / postMessage 없이도(COOP 영향 없이) 안전하게 감지된다.
 */
export function onTokenStored(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY && e.newValue) cb();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
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
  if (res.status === 401) {
    // 토큰 만료/무효 → 로그아웃 후 랜딩으로
    clearToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/';
    }
  }
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || `요청 실패 (${res.status})`);
  }
  return data as T;
}
