// 관리자 — 통계·회원 관리·모임/그룹 모더레이션 (requireAuth + requireAdmin 통과 후)
import { json, fail } from './http.js';
import { nowIso, isId } from './db.js';

// 통계 개요
export async function stats(request, env) {
  const db = env.DB;
  const [users, admins, events, tiers, rooms, friendships] = await db.batch([
    db.prepare('SELECT COUNT(*) AS c FROM users'),
    db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1'),
    db.prepare('SELECT COUNT(*) AS c FROM events'),
    db.prepare('SELECT COUNT(*) AS c FROM tiers'),
    db.prepare('SELECT COUNT(*) AS c FROM rooms'),
    db.prepare('SELECT COUNT(*) AS c FROM friendships'),
  ]);
  const n = (r) => r.results[0].c;
  return json({
    ok: true,
    stats: {
      users: n(users),
      admins: n(admins),
      events: n(events),
      tiers: n(tiers),
      rooms: n(rooms),
      friendships: n(friendships),
    },
  });
}

// 가입자 목록
export async function users(request, env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, nickname, email, picture, is_admin, created_at FROM users ORDER BY created_at ASC'
  ).all();
  return json({
    ok: true,
    users: results.map((u) => ({
      _id: u.id,
      name: u.name,
      nickname: u.nickname,
      email: u.email,
      picture: u.picture,
      isAdmin: !!u.is_admin,
      createdAt: u.created_at,
    })),
  });
}

// 관리자 권한 부여/회수
export async function setAdmin(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const isAdmin = !!body?.isAdmin;
  if (params.id === userId && !isAdmin) return fail('본인의 관리자 권한은 회수할 수 없습니다.');
  const db = env.DB;
  const r = await db
    .prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?')
    .bind(isAdmin ? 1 : 0, nowIso(), params.id)
    .run();
  if (!r.meta.changes) return fail('사용자를 찾을 수 없습니다.', 404);
  const u = await db.prepare('SELECT id, name, email, is_admin FROM users WHERE id = ?').bind(params.id).first();
  return json({ ok: true, user: { _id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin } });
}

// 회원 삭제 — 관련 데이터는 FK ON DELETE CASCADE 가 정리한다
export async function removeUser(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  if (params.id === userId) return fail('본인 계정은 삭제할 수 없습니다.');
  const r = await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(params.id).run();
  if (!r.meta.changes) return fail('사용자를 찾을 수 없습니다.', 404);
  return json({ ok: true });
}

/** 모임/그룹 모더레이션 목록 — 두 테이블이 같은 형태라 공용 */
function listing(table, key) {
  return async (request, env) => {
    const { results } = await env.DB.prepare(
      `SELECT t.id, t.name, t.code, t.created_at,
              (SELECT COUNT(*) FROM ${table === 'rooms' ? 'room_members m WHERE m.room_id' : 'tier_members m WHERE m.tier_id'} = t.id) AS member_count,
              u.name AS owner_name, u.email AS owner_email
       FROM ${table} t LEFT JOIN users u ON u.id = t.owner
       ORDER BY t.created_at DESC`
    ).all();
    return json({
      ok: true,
      [key]: results.map((r) => ({
        _id: r.id,
        name: r.name,
        code: r.code,
        memberCount: r.member_count,
        owner: r.owner_name || r.owner_email || '-',
        createdAt: r.created_at,
      })),
    });
  };
}

function removal(table, label) {
  return async (request, env, params) => {
    if (!isId(params.id)) return fail('잘못된 id 입니다.');
    const r = await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(params.id).run();
    if (!r.meta.changes) return fail(`${label}을 찾을 수 없습니다.`, 404);
    return json({ ok: true });
  };
}

export const rooms = listing('rooms', 'rooms');
export const tiers = listing('tiers', 'tiers');
export const removeRoom = removal('rooms', '모임');
export const removeTier = removal('tiers', '그룹');
