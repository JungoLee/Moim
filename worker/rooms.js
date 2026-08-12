// 모임 방 — 코드로 초대된 멤버들이 가능한 날짜를 등록하면 모두 되는 날을 집계한다.
import { json, fail } from './http.js';
import { newId, nowIso, isId, userBrief } from './db.js';
import { generateUniqueCode } from './tiers.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const STATUSES = new Set(['yes', 'no', 'after']);

// 멤버 marks 정규화: [{date, status, time?}] (날짜당 1개)
function cleanMarks(marks) {
  if (!Array.isArray(marks)) return [];
  const seen = new Set();
  const out = [];
  for (const m of marks) {
    if (!m || typeof m.date !== 'string' || !DATE_RE.test(m.date)) continue;
    if (!STATUSES.has(m.status)) continue;
    if (seen.has(m.date)) continue;
    seen.add(m.date);
    const mk = { date: m.date, status: m.status, time: '' };
    if (m.status === 'after') mk.time = typeof m.time === 'string' && TIME_RE.test(m.time) ? m.time : '18:00';
    out.push(mk);
  }
  return out;
}

/** 방장이거나 멤버인가 */
async function isMember(db, roomId, ownerId, userId) {
  if (ownerId === userId) return true;
  const row = await db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').bind(roomId, userId).first();
  return !!row;
}

// 내 방 목록 (소유 + 참여)
export async function list(request, env, params, body, userId) {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.name, r.code, r.owner,
            (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS member_count
     FROM rooms r
     WHERE r.owner = ? OR EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.user_id = ?)
     ORDER BY r.created_at DESC`
  )
    .bind(userId, userId)
    .all();
  return json({
    ok: true,
    rooms: results.map((r) => ({
      _id: r.id,
      name: r.name,
      code: r.code,
      memberCount: r.member_count,
      isOwner: r.owner === userId,
    })),
  });
}

// 방 생성 (생성자를 멤버로 포함)
export async function create(request, env, params, body, userId) {
  const name = body?.name;
  if (!name || !name.trim()) return fail('name 이 필요합니다.');
  const db = env.DB;
  const id = newId();
  const ts = nowIso();
  const code = await generateUniqueCode(db, 'rooms');
  await db.batch([
    db
      .prepare('INSERT INTO rooms (id, owner, name, code, join_by_url, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .bind(id, userId, name.trim(), code, ts, ts),
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').bind(id, userId),
  ]);
  return json({ ok: true, room: { _id: id, name: name.trim(), code } }, 201);
}

// 코드로 입장 (멱등)
export async function join(request, env, params, body, userId) {
  const code = body?.code;
  if (!code) return fail('code 가 필요합니다.');
  const db = env.DB;
  const room = await db.prepare('SELECT id, name FROM rooms WHERE code = ?').bind(code.trim().toUpperCase()).first();
  if (!room) return fail('해당 코드의 방이 없습니다.', 404);
  await db
    .prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)')
    .bind(room.id, userId)
    .run();
  return json({ ok: true, roomId: room.id, name: room.name });
}

// 방 상세 (멤버 + 가용성 + 댓글)
export async function detail(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const room = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(params.id).first();
  if (!room) return fail('방을 찾을 수 없습니다.', 404);
  if (!(await isMember(db, room.id, room.owner, userId))) return fail('이 방의 멤버가 아닙니다.', 403);

  const [{ results: members }, { results: marks }, { results: comments }] = await db.batch([
    db
      .prepare(
        `SELECT u.id, u.name, u.nickname, u.email, u.picture
         FROM room_members m JOIN users u ON u.id = m.user_id WHERE m.room_id = ?`
      )
      .bind(room.id),
    db.prepare('SELECT user_id, date, status, time FROM room_availability_marks WHERE room_id = ?').bind(room.id),
    db.prepare('SELECT * FROM room_comments WHERE room_id = ? ORDER BY created_at ASC').bind(room.id),
  ]);

  const availabilities = {};
  for (const m of marks) {
    (availabilities[m.user_id] ||= []).push({ date: m.date, status: m.status, time: m.time || '' });
  }

  // 댓글 작성자 프로필 사진 매핑 (멤버 목록에서 조회)
  const picById = {};
  for (const m of members) picById[m.id] = m.picture || '';

  return json({
    ok: true,
    room: {
      _id: room.id,
      name: room.name,
      code: room.code,
      joinByUrl: !!room.join_by_url,
      owner: room.owner,
      members: members.map(userBrief),
    },
    availabilities,
    comments: comments.map((c) => ({
      _id: c.id,
      user: c.user_id,
      name: c.author_name,
      picture: picById[c.user_id] || '',
      text: c.text,
      createdAt: c.created_at,
    })),
  });
}

// 내 가능 날짜 저장 (전체 교체)
export async function putAvailability(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const room = await db.prepare('SELECT id, owner FROM rooms WHERE id = ?').bind(params.id).first();
  if (!room) return fail('방을 찾을 수 없습니다.', 404);
  if (!(await isMember(db, room.id, room.owner, userId))) return fail('이 방의 멤버가 아닙니다.', 403);

  const clean = cleanMarks(body?.marks);
  const stmts = [
    db.prepare('DELETE FROM room_availability_marks WHERE room_id = ? AND user_id = ?').bind(room.id, userId),
    ...clean.map((m) =>
      db
        .prepare('INSERT INTO room_availability_marks (room_id, user_id, date, status, time) VALUES (?, ?, ?, ?, ?)')
        .bind(room.id, userId, m.date, m.status, m.time)
    ),
  ];
  await db.batch(stmts); // D1 은 대화형 트랜잭션이 없어 다중 쓰기는 batch (원자적)
  return json({ ok: true });
}

// 댓글 작성
export async function addComment(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const text = (body?.text || '').trim();
  if (!text) return fail('내용을 입력하세요.');
  const db = env.DB;
  const room = await db.prepare('SELECT id, owner FROM rooms WHERE id = ?').bind(params.id).first();
  if (!room) return fail('방을 찾을 수 없습니다.', 404);
  if (!(await isMember(db, room.id, room.owner, userId))) return fail('이 방의 멤버가 아닙니다.', 403);

  const me = await db.prepare('SELECT name, nickname FROM users WHERE id = ?').bind(userId).first();
  const author = me?.nickname || me?.name || '';
  await db
    .prepare('INSERT INTO room_comments (id, room_id, user_id, author_name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(newId(), room.id, userId, author, text.slice(0, 1000), nowIso())
    .run();
  return json({ ok: true }, 201);
}

// 댓글 삭제 (작성자 또는 방장)
export async function removeComment(request, env, params, body, userId) {
  if (!isId(params.id) || !isId(params.commentId)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const room = await db.prepare('SELECT id, owner FROM rooms WHERE id = ?').bind(params.id).first();
  if (!room) return fail('방을 찾을 수 없습니다.', 404);
  const c = await db
    .prepare('SELECT id, user_id FROM room_comments WHERE id = ? AND room_id = ?')
    .bind(params.commentId, room.id)
    .first();
  if (!c) return fail('댓글을 찾을 수 없습니다.', 404);
  if (c.user_id !== userId && room.owner !== userId) return fail('삭제 권한이 없습니다.', 403);
  await db.prepare('DELETE FROM room_comments WHERE id = ?').bind(c.id).run();
  return json({ ok: true });
}

// 방 설정 변경 (방장만): 이름 / URL 가입 허용
export async function update(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const b = body || {};
  const sets = [];
  const args = [];
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) return fail('이름이 비어 있습니다.');
    sets.push('name = ?');
    args.push(name);
  }
  if (b.joinByUrl !== undefined) {
    sets.push('join_by_url = ?');
    args.push(b.joinByUrl ? 1 : 0);
  }
  if (!sets.length) return fail('변경할 내용이 없습니다.');

  const r = await env.DB.prepare(`UPDATE rooms SET ${sets.join(', ')}, updated_at = ? WHERE id = ? AND owner = ?`)
    .bind(...args, nowIso(), params.id, userId)
    .run();
  if (!r.meta.changes) return fail('방을 찾을 수 없거나 권한이 없습니다.', 404);
  return json({ ok: true });
}

// 초대 코드 재발급 (방장만) — 기존 코드/링크 무효화
export async function regenerateCode(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const room = await db.prepare('SELECT id FROM rooms WHERE id = ? AND owner = ?').bind(params.id, userId).first();
  if (!room) return fail('방을 찾을 수 없거나 권한이 없습니다.', 404);
  const code = await generateUniqueCode(db, 'rooms');
  await db.prepare('UPDATE rooms SET code = ?, updated_at = ? WHERE id = ?').bind(code, nowIso(), room.id).run();
  return json({ ok: true, code });
}

// 멤버 강퇴 (방장만, 방장 본인은 불가)
export async function removeMember(request, env, params, body, userId) {
  const { id, userId: memberId } = params;
  if (!isId(id) || !isId(memberId)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const room = await db.prepare('SELECT id, owner FROM rooms WHERE id = ? AND owner = ?').bind(id, userId).first();
  if (!room) return fail('방을 찾을 수 없거나 권한이 없습니다.', 404);
  if (memberId === room.owner) return fail('방장은 강퇴할 수 없습니다.');
  await db.batch([
    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').bind(id, memberId),
    db.prepare('DELETE FROM room_availability_marks WHERE room_id = ? AND user_id = ?').bind(id, memberId),
  ]);
  return json({ ok: true });
}

// URL 가입 — 코드 없이 입장. 방장이 허용(joinByUrl)했을 때만 자동 가입, 아니면 코드 필요.
export async function joinByUrl(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const room = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(params.id).first();
  if (!room) return fail('방을 찾을 수 없습니다.', 404);
  if (await isMember(db, room.id, room.owner, userId)) {
    return json({ ok: true, roomId: room.id, name: room.name });
  }
  if (!room.join_by_url) return fail('초대 코드로 입장하세요.', 403, { needCode: true });
  await db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').bind(room.id, userId).run();
  return json({ ok: true, roomId: room.id, name: room.name });
}

// 방 삭제 (owner 만)
export async function remove(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const r = await env.DB.prepare('DELETE FROM rooms WHERE id = ? AND owner = ?').bind(params.id, userId).run();
  if (!r.meta.changes) return fail('방을 찾을 수 없거나 권한이 없습니다.', 404);
  return json({ ok: true });
}
