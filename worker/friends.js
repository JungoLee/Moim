// 친구 — 목록·요청·수락·거절 (친구 관계 = 캘린더 열람 권한)
import { json, fail } from './http.js';
import { newId, nowIso, isId } from './db.js';

// 내 친구 목록 (수락된 관계) — 상대만 추려서 반환
export async function list(request, env, params, body, userId) {
  const { results } = await env.DB.prepare(
    `SELECT f.id AS friendship_id, u.id, u.name, u.email, u.picture
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester = ? THEN f.recipient ELSE f.requester END
     WHERE f.status = 'accepted' AND (f.requester = ? OR f.recipient = ?)`
  )
    .bind(userId, userId, userId)
    .all();
  const friends = results.map((r) => ({
    friendshipId: r.friendship_id,
    user: { _id: r.id, name: r.name, email: r.email, picture: r.picture },
  }));
  return json({ ok: true, friends });
}

// 받은 친구 요청
export async function received(request, env, params, body, userId) {
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.recipient, f.status, f.created_at, f.updated_at,
            u.id AS r_id, u.name AS r_name, u.email AS r_email, u.picture AS r_picture
     FROM friendships f JOIN users u ON u.id = f.requester
     WHERE f.recipient = ? AND f.status = 'pending'`
  )
    .bind(userId)
    .all();
  const requests = results.map((r) => ({
    _id: r.id,
    requester: { _id: r.r_id, name: r.r_name, email: r.r_email, picture: r.r_picture },
    recipient: r.recipient,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return json({ ok: true, requests });
}

// 친구 요청 보내기 (이메일로)
export async function send(request, env, params, body, userId) {
  const email = body?.email;
  if (!email) return fail('email 이 필요합니다.');
  const db = env.DB;
  const target = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!target) return fail('해당 이메일의 사용자가 없습니다.', 404);
  if (target.id === userId) return fail('자기 자신에게는 요청할 수 없습니다.');

  const existing = await db
    .prepare(
      `SELECT id FROM friendships
       WHERE (requester = ? AND recipient = ?) OR (requester = ? AND recipient = ?)`
    )
    .bind(userId, target.id, target.id, userId)
    .first();
  if (existing) return fail('이미 친구이거나 요청이 진행 중입니다.', 409);

  const id = newId();
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO friendships (id, requester, recipient, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    )
    .bind(id, userId, target.id, ts, ts)
    .run();
  return json(
    { ok: true, friendship: { _id: id, requester: userId, recipient: target.id, status: 'pending', createdAt: ts, updatedAt: ts } },
    201
  );
}

// 요청 수락
export async function accept(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const r = await db
    .prepare(
      `UPDATE friendships SET status = 'accepted', updated_at = ?
       WHERE id = ? AND recipient = ? AND status = 'pending'`
    )
    .bind(nowIso(), params.id, userId)
    .run();
  if (!r.meta.changes) return fail('요청을 찾을 수 없습니다.', 404);
  const row = await db.prepare('SELECT * FROM friendships WHERE id = ?').bind(params.id).first();
  return json({
    ok: true,
    friendship: {
      _id: row.id,
      requester: row.requester,
      recipient: row.recipient,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
}

// 요청 거절 (행 삭제)
export async function decline(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const r = await env.DB.prepare(
    `DELETE FROM friendships WHERE id = ? AND recipient = ? AND status = 'pending'`
  )
    .bind(params.id, userId)
    .run();
  if (!r.meta.changes) return fail('요청을 찾을 수 없습니다.', 404);
  return json({ ok: true });
}
