// 인증 — JWT(jose HS256) · Google OAuth · 이메일 코드 로그인 · 내 정보 · 연차 설정
// JWT 는 기존 Express 판과 완전 호환(같은 시크릿·HS256·{ sub } · 30일)이라 기존 로그인이 유지된다.
import { SignJWT, jwtVerify } from 'jose';
import { json, fail } from './http.js';
import { newId, nowIso, userDoc } from './db.js';
import { buildAuthUrl, fetchProfile } from './google.js';
import { sendLoginCode, hasMailTransport } from './mailer.js';

const secretKey = (env) => new TextEncoder().encode(env.JWT_SECRET);

async function signToken(sub, env) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey(env));
}

/** Authorization: Bearer <token> 검증 → userId. 실패 시 null */
async function verifyRequest(request, env) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), secretKey(env), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * 보호 라우트용. 통과하면 { userId }, 실패하면 { response } 를 돌려준다.
 * 서명 검증만으로는 부족 — 탈퇴한 계정의 JWT 가 만료(30일)까지 살아있으므로
 * 사용자가 실제로 존재하는지 확인해 유령 세션을 401 로 끊는다(프론트 401 = 자동 로그아웃).
 */
export async function requireAuth(request, env) {
  const userId = await verifyRequest(request, env);
  if (!userId) return { response: fail('인증이 필요합니다.', 401) };
  const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!row) return { response: fail('탈퇴했거나 존재하지 않는 계정입니다.', 401) };
  return { userId };
}

/** 관리자 확인 — requireAuth 통과 후에만 호출 */
export async function requireAdmin(env, userId) {
  const row = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(userId).first();
  if (!row || !row.is_admin) return fail('관리자 권한이 없습니다.', 403);
  return null;
}

/** 기본 관리자 이메일 판정 (콤마로 여러 개, env ADMIN_EMAILS) */
function isAdminEmail(email, env) {
  const list = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || '').toLowerCase());
}

// ── Google OAuth ────────────────────────────────────────────────

export function googleStart(request, env) {
  const origin = new URL(request.url).origin;
  return Response.redirect(buildAuthUrl(origin, env), 302);
}

export async function googleCallback(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  if (!code) return Response.redirect(`${origin}/?error=auth`, 302);
  try {
    const profile = await fetchProfile(code, origin, env);
    const email = (profile.email || '').toLowerCase();
    const admin = isAdminEmail(email, env);
    const db = env.DB;

    let row = await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(profile.id).first();
    // 이메일 코드로 먼저 가입한 계정이 있으면 구글 계정과 통합 (자리표시자 google_id 교체)
    if (!row && email) {
      row = await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(`email:${email}`).first();
      if (row) {
        await db.prepare('UPDATE users SET google_id = ? WHERE id = ?').bind(profile.id, row.id).run();
      }
    }

    let userId;
    if (!row) {
      userId = newId();
      const ts = nowIso();
      await db
        .prepare(
          `INSERT INTO users (id, google_id, email, name, nickname, picture, is_admin, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?, ?, ?)`
        )
        .bind(userId, profile.id, email, profile.name || '', profile.picture || '', admin ? 1 : 0, ts, ts)
        .run();
    } else {
      // 프로필 최신화 (admin 은 보장만 하고 강등하지 않음)
      userId = row.id;
      await db
        .prepare(
          `UPDATE users SET email = ?, name = ?, picture = ?, is_admin = ?, updated_at = ? WHERE id = ?`
        )
        .bind(
          email || row.email,
          profile.name || row.name,
          profile.picture || row.picture,
          admin ? 1 : row.is_admin,
          nowIso(),
          userId
        )
        .run();
    }

    const token = await signToken(userId, env);
    return Response.redirect(`${origin}/auth/callback?token=${token}`, 302);
  } catch (err) {
    console.error('[auth] 구글 로그인 실패:', err.message);
    return Response.redirect(`${origin}/?error=auth`, 302);
  }
}

// ── 이메일 코드 로그인 ──────────────────────────────────────────
// 흐름: 이메일 입력 → 6자 코드 발송 → 코드 입력(대소문자 구분) → JWT 발급.
// 같은 이메일의 기존 계정(구글 가입 포함)이 있으면 그 계정으로 로그인(메일함 소유 = 본인 증명).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 영문 대소문자 + 숫자(62자). 6칸 입력·붙여넣기를 전제로 하므로 헷갈리는 글자도 빼지 않는다.
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LEN = 6;
const CODE_TTL_MS = 10 * 60 * 1000; // 10분 (메일 발송 시)
const MANUAL_TTL_MS = 30 * 60 * 1000; // 30분 — 발송 수단이 없을 때(로그 확인) 여유
const RESEND_COOLDOWN_MS = 60 * 1000; // 재전송 60초
const MAX_ATTEMPTS = 5;

async function hashCode(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 문자셋에서 균일 무작위 문자열 (모듈러 바이어스 제거) */
function randomFrom(chars, len) {
  const max = Math.floor(256 / chars.length) * chars.length;
  let out = '';
  while (out.length < len) {
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    for (const b of bytes) {
      if (b >= max) continue; // 편향 구간은 버림
      out += chars[b % chars.length];
      if (out.length === len) break;
    }
  }
  return out;
}

// 메일 발송 IP 제한 — 이메일별 쿨다운만으로는 주소를 바꿔가며 무제한 발송이 가능해
// 무료 쿼터(하루 100통)가 소진될 수 있다. IP 당 하루 10통까지만 받는다.
const MAIL_PER_IP_PER_DAY = 10;

async function overMailRate(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const day = nowIso().slice(0, 10);
  // 지난 날짜의 키는 여기서 함께 정리한다
  await env.DB.prepare(`DELETE FROM mail_rate WHERE key NOT LIKE '%:' || ?`).bind(day).run();
  const row = await env.DB.prepare(
    'INSERT INTO mail_rate (key, count) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count',
  ).bind(`${ip}:${day}`).first();
  return row.count > MAIL_PER_IP_PER_DAY;
}

export async function emailRequest(request, env, params, body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return fail('올바른 이메일을 입력해주세요.');
  if (await overMailRate(request, env)) return fail('요청이 너무 많습니다. 내일 다시 시도해주세요.', 429);

  // Mongo TTL 인덱스가 없으므로 만료된 코드는 여기서 함께 정리한다
  await env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(nowIso()).run();

  const existing = await env.DB.prepare('SELECT sent_at FROM login_codes WHERE email = ?').bind(email).first();
  if (existing && Date.now() - new Date(existing.sent_at).getTime() < RESEND_COOLDOWN_MS) {
    return fail('잠시 후 다시 요청해주세요. (1분에 1회)', 429);
  }

  const code = randomFrom(CODE_CHARS, CODE_LEN);
  const deliverable = hasMailTransport(env);
  const ttl = deliverable ? CODE_TTL_MS : MANUAL_TTL_MS;
  await env.DB.prepare(
    `INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`
  )
    .bind(email, await hashCode(code), new Date(Date.now() + ttl).toISOString(), nowIso())
    .run();

  try {
    await sendLoginCode(email, code, env);
  } catch (err) {
    console.error('[mail] 발송 실패:', err.message);
    return fail('메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.', 500);
  }
  return json({ ok: true, manual: !deliverable });
}

export async function emailVerify(request, env, params, body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body?.code === 'string' ? body.code.replace(/[\s-]/g, '') : '';
  if (!EMAIL_RE.test(email) || !code) return fail('이메일과 코드를 입력해주세요.');

  const db = env.DB;
  const entry = await db.prepare('SELECT * FROM login_codes WHERE email = ?').bind(email).first();
  if (!entry || new Date(entry.expires_at).getTime() < Date.now()) {
    if (entry) await db.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
    return fail('코드가 만료됐어요. 다시 요청해주세요.');
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    await db.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
    return fail('시도 횟수를 초과했어요. 코드를 다시 요청해주세요.');
  }
  if (entry.code_hash !== (await hashCode(code))) {
    const attempts = entry.attempts + 1;
    await db.prepare('UPDATE login_codes SET attempts = ? WHERE email = ?').bind(attempts, email).run();
    return fail(`코드가 일치하지 않아요. (${MAX_ATTEMPTS - attempts}회 남음)`);
  }
  await db.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run(); // 일회용

  let user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) {
    const id = newId();
    const ts = nowIso();
    await db
      .prepare(
        `INSERT INTO users (id, google_id, email, name, nickname, picture, is_admin, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', '', ?, ?, ?)`
      )
      // google_id 는 NOT NULL·UNIQUE — 이메일 가입자는 자리표시자로 채운다.
      // 이후 같은 이메일로 구글 로그인하면 실제 google_id 로 교체된다(계정 통합).
      .bind(id, `email:${email}`, email, email.split('@')[0], isAdminEmail(email, env) ? 1 : 0, ts, ts)
      .run();
    user = { id };
  }
  return json({ ok: true, token: await signToken(user.id, env) });
}

// ── 내 정보 ────────────────────────────────────────────────────

export async function getMe(request, env, params, body, userId) {
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!row) return fail('사용자를 찾을 수 없습니다.', 404);
  return json({ ok: true, user: userDoc(row) });
}

export async function patchMe(request, env, params, body, userId) {
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim().slice(0, 30) : '';
  await env.DB.prepare('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?')
    .bind(nickname, nowIso(), userId)
    .run();
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!row) return fail('사용자를 찾을 수 없습니다.', 404);
  return json({ ok: true, user: userDoc(row) });
}

/** 회원 탈퇴 — 관련 데이터는 FK ON DELETE CASCADE 가 정리한다 */
export async function deleteMe(request, env, params, body, userId) {
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return json({ ok: true });
}

// ── 연차 계산기 설정 (사용자별 유지 + 갱신일 자동 이월) ──────────
const pad2 = (n) => String(n).padStart(2, '0');
// 한국(KST) 기준 오늘 (서버가 UTC여도 동일하게 동작)
function kstToday() {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())}`;
}
function addOneYear(ymd) {
  if (!ymd) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y + 1, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
// 갱신일이 오늘 이하면 시작일·갱신일을 1년씩 미뤄 다음 주기로 이월. 바뀌면 true.
function rollForward(leave) {
  const today = kstToday();
  let changed = false;
  // 'YYYY-MM-DD' 는 사전순 비교 == 날짜순 비교
  while (leave.renewal && leave.renewal <= today) {
    leave.start = addOneYear(leave.start);
    leave.renewal = addOneYear(leave.renewal);
    changed = true;
  }
  return changed;
}

export async function getLeave(request, env, params, body, userId) {
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!row) return fail('사용자를 찾을 수 없습니다.', 404);
  const leave = userDoc(row).leave;
  if (rollForward(leave)) {
    await env.DB.prepare('UPDATE users SET leave_start = ?, leave_renewal = ?, updated_at = ? WHERE id = ?')
      .bind(leave.start, leave.renewal, nowIso(), userId)
      .run();
  }
  return json({ ok: true, leave });
}

export async function putLeave(request, env, params, body, userId) {
  const b = body || {};
  const styles = ['short', 'balanced', 'long'];
  const leave = {
    remaining: Number.isFinite(+b.remaining) ? +b.remaining : 15,
    start: typeof b.start === 'string' ? b.start.slice(0, 10) : '',
    renewal: typeof b.renewal === 'string' ? b.renewal.slice(0, 10) : '',
    maxConsec: Number.isFinite(+b.maxConsec) ? Math.min(20, Math.max(1, Math.trunc(+b.maxConsec))) : 5,
    style: styles.includes(b.style) ? b.style : 'balanced',
  };
  rollForward(leave);
  const r = await env.DB.prepare(
    `UPDATE users SET leave_remaining = ?, leave_start = ?, leave_renewal = ?,
     leave_max_consec = ?, leave_style = ?, updated_at = ? WHERE id = ?`
  )
    .bind(leave.remaining, leave.start, leave.renewal, leave.maxConsec, leave.style, nowIso(), userId)
    .run();
  if (!r.meta.changes) return fail('사용자를 찾을 수 없습니다.', 404);
  return json({ ok: true, leave });
}
