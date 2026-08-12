// Cloudflare Workers 엔트리 — /api/* 는 이 워커가, 그 외는 정적 자산(frontend/out)이 처리.
// Express 를 쓰지 않고 최소 라우터로 대체 (MyBudget 과 같은 패턴)
import { json, fail } from './http.js';
import * as auth from './auth.js';
import * as events from './events.js';
import * as friends from './friends.js';
import * as calendar from './calendar.js';
import * as tiers from './tiers.js';
import * as rooms from './rooms.js';
import * as requests from './requests.js';
import * as admin from './admin.js';

// [method, pattern, handler, auth]  — auth: false | true(로그인) | 'admin'
const ROUTES = [
  ['GET', '/api/health', () => json({ ok: true, service: 'moim-worker' }), false],

  // 인증
  ['GET', '/api/auth/google', auth.googleStart, false],
  ['GET', '/api/auth/google/callback', auth.googleCallback, false],
  ['POST', '/api/auth/email/request', auth.emailRequest, false],
  ['POST', '/api/auth/email/verify', auth.emailVerify, false],
  ['GET', '/api/auth/me', auth.getMe, true],
  ['PATCH', '/api/auth/me', auth.patchMe, true],
  ['DELETE', '/api/auth/me', auth.deleteMe, true],
  ['GET', '/api/auth/leave', auth.getLeave, true],
  ['PUT', '/api/auth/leave', auth.putLeave, true],

  // 일정
  ['GET', '/api/events', events.list, true],
  ['POST', '/api/events', events.create, true],
  ['PATCH', '/api/events/:id', events.update, true],
  ['DELETE', '/api/events/:id', events.remove, true],

  // 친구
  ['GET', '/api/friends', friends.list, true],
  ['GET', '/api/friends/requests', friends.received, true],
  ['POST', '/api/friends/requests', friends.send, true],
  ['POST', '/api/friends/requests/:id/accept', friends.accept, true],
  ['POST', '/api/friends/requests/:id/decline', friends.decline, true],

  // 캘린더(타인)
  ['GET', '/api/calendar/:userId', calendar.get, true],

  // 그룹
  ['GET', '/api/tiers', tiers.list, true],
  ['POST', '/api/tiers', tiers.create, true],
  ['POST', '/api/tiers/join', tiers.join, true],
  ['PATCH', '/api/tiers/:id', tiers.update, true],
  ['DELETE', '/api/tiers/:id', tiers.remove, true],
  ['POST', '/api/tiers/:id/members', tiers.addMember, true],
  ['DELETE', '/api/tiers/:id/members/:userId', tiers.removeMember, true],

  // 모임 방
  ['GET', '/api/rooms', rooms.list, true],
  ['POST', '/api/rooms', rooms.create, true],
  ['POST', '/api/rooms/join', rooms.join, true],
  ['GET', '/api/rooms/:id', rooms.detail, true],
  ['PATCH', '/api/rooms/:id', rooms.update, true],
  ['DELETE', '/api/rooms/:id', rooms.remove, true],
  ['PUT', '/api/rooms/:id/availability', rooms.putAvailability, true],
  ['POST', '/api/rooms/:id/comments', rooms.addComment, true],
  ['DELETE', '/api/rooms/:id/comments/:commentId', rooms.removeComment, true],
  ['POST', '/api/rooms/:id/code', rooms.regenerateCode, true],
  ['DELETE', '/api/rooms/:id/members/:userId', rooms.removeMember, true],
  ['POST', '/api/rooms/:id/join-url', rooms.joinByUrl, true],

  // 시간 요청
  ['GET', '/api/requests/received', requests.received, true],
  ['GET', '/api/requests/sent', requests.sent, true],
  ['POST', '/api/requests', requests.create, true],
  ['POST', '/api/requests/:id/accept', requests.accept, true],
  ['POST', '/api/requests/:id/decline', requests.decline, true],
  ['DELETE', '/api/requests/:id', requests.remove, true],

  // 관리자
  ['GET', '/api/admin/stats', admin.stats, 'admin'],
  ['GET', '/api/admin/users', admin.users, 'admin'],
  ['PATCH', '/api/admin/users/:id/admin', admin.setAdmin, 'admin'],
  ['DELETE', '/api/admin/users/:id', admin.removeUser, 'admin'],
  ['GET', '/api/admin/rooms', admin.rooms, 'admin'],
  ['DELETE', '/api/admin/rooms/:id', admin.removeRoom, 'admin'],
  ['GET', '/api/admin/tiers', admin.tiers, 'admin'],
  ['DELETE', '/api/admin/tiers/:id', admin.removeTier, 'admin'],
];

// '/api/rooms/:id/comments/:commentId' 같은 패턴 매칭 — 일치하면 params 객체 반환
function matchPath(pattern, pathname) {
  const p = pattern.split('/');
  const s = pathname.split('/');
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

async function readJsonBody(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return null;
  try {
    return await request.json();
  } catch {
    return null; // 본문이 없거나 JSON 이 아님 — 핸들러가 검증한다
  }
}

/**
 * 정적 export 로는 만들 수 없는 옛 동적 경로를 쿼리스트링 페이지로 넘긴다.
 * (기존 초대 링크 /rooms/<id> · 프로필 링크 /u/<id> 호환)
 */
function legacyRedirect(url) {
  const m = url.pathname.match(/^\/(rooms|u)\/([^/]+)\/?$/);
  if (!m) return null;
  const [, kind, id] = m;
  if (kind === 'rooms' && id === 'detail') return null; // 새 경로 자체
  const dest = new URL(kind === 'rooms' ? '/rooms/detail' : '/u', url);
  dest.searchParams.set('id', id);
  for (const [k, v] of url.searchParams) dest.searchParams.set(k, v);
  return Response.redirect(dest.toString(), 301);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      for (const [method, pattern, handler, needsAuth] of ROUTES) {
        if (request.method !== method) continue;
        const params = matchPath(pattern, url.pathname);
        if (!params) continue;

        try {
          let userId = null;
          if (needsAuth) {
            const res = await auth.requireAuth(request, env);
            if (res.response) return res.response;
            userId = res.userId;
            if (needsAuth === 'admin') {
              const denied = await auth.requireAdmin(env, userId);
              if (denied) return denied;
            }
          }
          const body = await readJsonBody(request);
          return await handler(request, env, params, body, userId);
        } catch (err) {
          console.error(`[api] ${method} ${url.pathname} 실패:`, err.message);
          return fail('서버 오류가 발생했습니다.', 500);
        }
      }
      return fail(`Route ${url.pathname} not found`, 404);
    }

    const redirect = legacyRedirect(url);
    if (redirect) return redirect;

    // 정적 자산 (frontend/out) — SPA 폴백은 wrangler.toml 의 not_found_handling 이 처리
    return env.ASSETS.fetch(request);
  },
};
