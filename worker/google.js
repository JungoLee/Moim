// Google OAuth — passport-google-oauth20 을 fetch 로 대체 (Workers 는 passport 미지원)
// 콜백 URL 은 요청 origin 에서 유도한다(로컬 8790 / 운영 moim.opnae.com 자동 대응).

const callbackUrl = (origin) => `${origin}/api/auth/google/callback`;

/** 구글 동의 화면 URL */
export function buildAuthUrl(origin, env) {
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(origin),
    response_type: 'code',
    scope: 'profile email',
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** code → access_token */
async function exchangeCode(code, origin, env) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(origin),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`토큰 교환 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

/** access_token → 프로필 { sub, email, name, picture } (passport 의 profile 과 동일한 정보) */
export async function fetchProfile(code, origin, env) {
  const { access_token: accessToken } = await exchangeCode(code, origin, env);
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`프로필 조회 실패 (${res.status})`);
  const p = await res.json();
  return { id: p.sub, email: p.email || '', name: p.name || '', picture: p.picture || '' };
}
