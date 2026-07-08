'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, setToken, googleLoginUrl, onTokenStored, warmApi } from '@/lib/api';
import { isInAppBrowser, escapeInAppBrowser } from '@/lib/inapp';
import { toast } from '@/lib/toast';
import { BRAND_NAME } from '@/lib/brand';
import Notice from '@/components/Notice';

// 로그인 후 돌아갈 곳: 기억해둔 경로(예: 공유받은 모임 URL) 우선, 없으면 /home
function consumePostLoginDest(): string {
  try {
    const n = sessionStorage.getItem('postLoginRedirect');
    if (n) {
      sessionStorage.removeItem('postLoginRedirect');
      return n;
    }
  } catch {
    /* 무시 */
  }
  return '/home';
}

export default function Home() {
  const router = useRouter();
  // 이메일 코드 로그인 (구글 계정이 없어도 로그인)
  const [emailOpen, setEmailOpen] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // 백엔드(별도 서비스)를 미리 깨워 로그인 시 콜드스타트 화면을 줄인다.
    warmApi();
    if (getToken()) {
      router.replace(consumePostLoginDest());
      return;
    }
    // 로그인 팝업이 토큰을 저장하면(동일 출처 localStorage 공유) 기억해둔 곳/홈으로 이동
    return onTokenStored(() => router.replace(consumePostLoginDest()));
  }, [router]);

  // 입력한 이메일로 12자리 인증 코드 발송 (재전송에도 재사용)
  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ manual?: boolean }>('/api/auth/email/request', { method: 'POST', body: { email: email.trim() } });
      setStep('code');
      setCode('');
      setNotice({
        ok: true,
        text: r.manual
          ? '지금은 관리자 승인 방식이에요 — 관리자가 확인 후 코드를 전달해드립니다(카톡 등). 받은 12자리 코드를 입력하세요. (30분 유효)'
          : `${email.trim()} 로 12자리 코드를 보냈어요. (10분 유효)`,
      });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : '코드 발송 실패' });
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api<{ token: string }>('/api/auth/email/verify', {
        method: 'POST',
        body: { email: email.trim(), code: code.trim() },
      });
      setToken(res.token);
      router.replace(consumePostLoginDest());
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : '인증 실패' });
      setBusy(false);
    }
  }

  function handleLogin() {
    // 카카오톡 등 인앱 브라우저는 구글 OAuth 가 차단됨(disallowed_useragent)
    // → 기본 브라우저로 탈출. 공유받은 방 URL(postLoginRedirect)이 있으면 그리로 열어준다.
    if (isInAppBrowser()) {
      let target = window.location.href;
      try {
        const n = sessionStorage.getItem('postLoginRedirect');
        if (n) target = window.location.origin + n;
      } catch {
        /* 무시 */
      }
      if (!escapeInAppBrowser(target)) {
        toast('인앱 브라우저에서는 구글 로그인이 막혀요. 메뉴(⋯ 또는 공유)에서 “다른 브라우저로 열기”를 눌러주세요.', 'error');
      }
      return;
    }
    const url = googleLoginUrl();
    const w = 480;
    const h = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(url, 'moim-google-login', `popup,width=${w},height=${h},left=${left},top=${top}`);
    // 팝업 차단 시 기존 전체 이동 방식으로 폴백
    if (!popup || popup.closed) window.location.href = url;
  }

  return (
    <main className="app-landing">
      {/* 부유하는 광원 (장식) */}
      <span className="app-orb app-orb--a" aria-hidden />
      <span className="app-orb app-orb--b" aria-hidden />

      <section className="app-hero">
        <div className="app-hero-eyebrow">✦ Social Calendar</div>
        <h1 className="brand-mark">{BRAND_NAME}</h1>
        <p className="app-hero-sub">
          친구들과 스케줄을 공유하고,
          <br />
          함께 비는 시간을 찾아 모임·여행을 잡으세요.
        </p>
        <button type="button" className="app-btn app-btn--google" onClick={handleLogin}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
          Google 계정으로 계속하기
        </button>

        <div className="app-hero-or">
          <span>또는</span>
        </div>

        {!emailOpen ? (
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={() => {
              setEmailOpen(true);
              setNotice(null);
            }}
          >
            ✉️ 이메일로 계속하기
          </button>
        ) : step === 'email' ? (
          <form className="app-hero-email" onSubmit={requestCode}>
            <input
              className="app-input"
              type="email"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button className="app-btn app-btn--ghost" type="submit" disabled={busy || !email.trim()}>
              {busy ? '보내는 중…' : '인증 코드 받기'}
            </button>
          </form>
        ) : (
          <form className="app-hero-email" onSubmit={verifyCode}>
            <input
              className="app-input app-hero-code"
              placeholder="12자리 코드 입력"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={16}
              autoComplete="one-time-code"
              autoFocus
            />
            <button className="app-btn app-btn--ghost" type="submit" disabled={busy || !code.trim()}>
              {busy ? '확인 중…' : '코드로 로그인'}
            </button>
            <div className="app-hero-links">
              <button type="button" onClick={() => requestCode()} disabled={busy}>
                코드 재전송
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setNotice(null);
                }}
              >
                다른 이메일로
              </button>
            </div>
          </form>
        )}
        {notice && <Notice ok={notice.ok}>{notice.text}</Notice>}
      </section>
    </main>
  );
}
