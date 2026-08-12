// 시간 요청 — "이때 시간 내주세요"를 친구에게 보내고 수락/거절. 수락 시 양쪽 캘린더에 일정 생성.
import { json, fail } from './http.js';
import { newId, nowIso, toIso, isId, userBrief, timeRequestDoc } from './db.js';

const SELECT_WITH = (joinCol, alias) => `
  SELECT t.*, u.id AS ${alias}_id, u.name AS ${alias}_name, u.nickname AS ${alias}_nickname,
         u.email AS ${alias}_email, u.picture AS ${alias}_picture
  FROM time_requests t JOIN users u ON u.id = t.${joinCol}`;

const brief = (r, alias) =>
  userBrief({
    id: r[`${alias}_id`],
    name: r[`${alias}_name`],
    nickname: r[`${alias}_nickname`],
    email: r[`${alias}_email`],
    picture: r[`${alias}_picture`],
  });

async function areFriends(db, a, b) {
  const row = await db
    .prepare(
      `SELECT 1 FROM friendships WHERE status = 'accepted'
       AND ((requester = ? AND recipient = ?) OR (requester = ? AND recipient = ?))`
    )
    .bind(a, b, b, a)
    .first();
  return !!row;
}

// 받은 시간 요청
export async function received(request, env, params, body, userId) {
  const { results } = await env.DB.prepare(
    `${SELECT_WITH('from_user', 'f')} WHERE t.to_user = ? ORDER BY t.created_at DESC`
  )
    .bind(userId)
    .all();
  return json({ ok: true, requests: results.map((r) => timeRequestDoc(r, brief(r, 'f'), r.to_user)) });
}

// 보낸 시간 요청
export async function sent(request, env, params, body, userId) {
  const { results } = await env.DB.prepare(
    `${SELECT_WITH('to_user', 't2')} WHERE t.from_user = ? ORDER BY t.created_at DESC`
  )
    .bind(userId)
    .all();
  return json({ ok: true, requests: results.map((r) => timeRequestDoc(r, r.from_user, brief(r, 't2'))) });
}

// 요청 보내기
export async function create(request, env, params, body, userId) {
  const { to, start, end, title, message, allDay } = body || {};
  if (!isId(to)) return fail('대상이 올바르지 않습니다.');
  if (to === userId) return fail('본인에게는 요청할 수 없습니다.');
  const startIso = toIso(start);
  const endIso = toIso(end);
  if (!startIso || !endIso) return fail('시작/종료 시간이 필요합니다.');
  const db = env.DB;
  if (!(await areFriends(db, userId, to))) return fail('친구에게만 시간 요청을 보낼 수 있습니다.', 403);

  const id = newId();
  const ts = nowIso();
  const safeTitle = (title || '').trim() || '시간 요청';
  await db
    .prepare(
      `INSERT INTO time_requests (id, from_user, to_user, title, start, end, all_day, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .bind(id, userId, to, safeTitle, startIso, endIso, allDay ? 1 : 0, (message || '').trim(), ts, ts)
    .run();
  const row = await db.prepare('SELECT * FROM time_requests WHERE id = ?').bind(id).first();
  return json({ ok: true, request: timeRequestDoc(row) }, 201);
}

// 수락 → 양쪽 캘린더에 일정 자동 생성
export async function accept(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const tr = await db
    .prepare(`SELECT * FROM time_requests WHERE id = ? AND to_user = ? AND status = 'pending'`)
    .bind(params.id, userId)
    .first();
  if (!tr) return fail('요청을 찾을 수 없습니다.', 404);

  // 일정 클릭 시 "누가 언제 요청했는지" 보이도록 출처를 스냅샷으로 남긴다
  const { results: users } = await db
    .prepare('SELECT id, name, nickname, email FROM users WHERE id IN (?, ?)')
    .bind(tr.from_user, tr.to_user)
    .all();
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  const label = (id) => {
    const u = byId[id];
    return (u && (u.nickname || u.name || u.email)) || '알 수 없음';
  };
  const ts = nowIso();
  // 둘 사이의 약속이므로 다른 친구에겐 상세 대신 "바쁨"만 보이게 비공개로 생성
  const mkEvent = (owner) =>
    db
      .prepare(
        `INSERT INTO events (id, owner, title, start, end, all_day, location, memo, visibility,
           origin_kind, origin_request_id, origin_from_name, origin_to_name, origin_requested_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '', '', 'private', 'timeRequest', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId(), owner, tr.title, tr.start, tr.end, tr.all_day,
        tr.id, label(tr.from_user), label(tr.to_user), tr.created_at, ts, ts
      );

  await db.batch([
    db.prepare(`UPDATE time_requests SET status = 'accepted', updated_at = ? WHERE id = ?`).bind(ts, tr.id),
    mkEvent(tr.to_user),
    mkEvent(tr.from_user),
  ]);
  return json({ ok: true });
}

// 거절
export async function decline(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const r = await env.DB.prepare(
    `UPDATE time_requests SET status = 'declined', updated_at = ? WHERE id = ? AND to_user = ? AND status = 'pending'`
  )
    .bind(nowIso(), params.id, userId)
    .run();
  if (!r.meta.changes) return fail('요청을 찾을 수 없습니다.', 404);
  return json({ ok: true });
}

// 보낸 요청 취소(대기중만)
export async function remove(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const r = await env.DB.prepare(
    `DELETE FROM time_requests WHERE id = ? AND from_user = ? AND status = 'pending'`
  )
    .bind(params.id, userId)
    .run();
  if (!r.meta.changes) return fail('취소할 요청을 찾을 수 없습니다.', 404);
  return json({ ok: true });
}
