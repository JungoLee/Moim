// 일정 CRUD
import { json, fail } from './http.js';
import { newId, nowIso, toIso, isId, placeholders, groupBy, eventDoc } from './db.js';

/** 여러 일정의 audienceTiers 를 한 번에 조회 → { [eventId]: [tierId] } */
async function loadAudience(db, ids) {
  if (!ids.length) return {};
  const { results } = await db
    .prepare(`SELECT event_id, tier_id FROM event_audience_tiers WHERE event_id IN (${placeholders(ids.length)})`)
    .bind(...ids)
    .all();
  return groupBy(results, 'event_id', 'tier_id');
}

/** 기간 필터(from/to)를 WHERE 절 조각으로 */
function rangeClause(url) {
  const from = toIso(url.searchParams.get('from'));
  const to = toIso(url.searchParams.get('to'));
  let sql = '';
  const args = [];
  if (from) {
    sql += ' AND start >= ?';
    args.push(from);
  }
  if (to) {
    sql += ' AND start <= ?';
    args.push(to);
  }
  return { sql, args };
}

// 내 일정 목록 (from/to 로 기간 필터)
export async function list(request, env, params, body, userId) {
  const db = env.DB;
  const { sql, args } = rangeClause(new URL(request.url));
  const { results } = await db
    .prepare(`SELECT * FROM events WHERE owner = ?${sql} ORDER BY start ASC`)
    .bind(userId, ...args)
    .all();

  const audience = await loadAudience(db, results.map((r) => r.id));

  // 시간 요청 일정: 상대방 사본이 아직 살아있는지 표시 (삭제됐으면 클릭 시 안내용)
  const reqIds = [...new Set(results.filter((r) => r.origin_kind === 'timeRequest' && r.origin_request_id).map((r) => r.origin_request_id))];
  let alive = new Set();
  if (reqIds.length) {
    const { results: partners } = await db
      .prepare(
        `SELECT DISTINCT origin_request_id AS rid FROM events
         WHERE origin_request_id IN (${placeholders(reqIds.length)}) AND owner != ?`
      )
      .bind(...reqIds, userId)
      .all();
    alive = new Set(partners.map((p) => p.rid));
  }

  const events = results.map((r) => {
    const doc = eventDoc(r, audience[r.id] || []);
    if (r.origin_kind === 'timeRequest' && r.origin_request_id) {
      doc.originPartnerGone = !alive.has(r.origin_request_id);
    }
    return doc;
  });
  return json({ ok: true, events });
}

// 비공개 일정의 audienceTiers 입력 정규화 (유효한 id 배열만)
function normalizeAudience(audienceTiers) {
  if (!Array.isArray(audienceTiers)) return [];
  return [...new Set(audienceTiers.filter(isId))];
}

/** audienceTiers 재작성 statement 목록 (batch 용). 존재하지 않는 그룹은 FK 가 막으므로 사전 필터 */
async function audienceStatements(db, eventId, tierIds) {
  const stmts = [db.prepare('DELETE FROM event_audience_tiers WHERE event_id = ?').bind(eventId)];
  if (tierIds.length) {
    const { results } = await db
      .prepare(`SELECT id FROM tiers WHERE id IN (${placeholders(tierIds.length)})`)
      .bind(...tierIds)
      .all();
    for (const t of results) {
      stmts.push(
        db.prepare('INSERT INTO event_audience_tiers (event_id, tier_id) VALUES (?, ?)').bind(eventId, t.id)
      );
    }
  }
  return stmts;
}

// 일정 생성
export async function create(request, env, params, body, userId) {
  const { title, start, end, allDay, location, memo, visibility, audienceTiers } = body || {};
  const startIso = toIso(start);
  const endIso = toIso(end);
  if (!title || !startIso || !endIso) return fail('title, start, end 는 필수입니다.');

  const db = env.DB;
  const isPrivate = visibility === 'private';
  const id = newId();
  const ts = nowIso();
  const tierIds = isPrivate ? normalizeAudience(audienceTiers) : [];

  const stmts = [
    db
      .prepare(
        `INSERT INTO events (id, owner, title, start, end, all_day, location, memo, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, title, startIso, endIso, allDay ? 1 : 0, location || '', memo || '', isPrivate ? 'private' : 'public', ts, ts),
    ...(await audienceStatements(db, id, tierIds)).slice(1), // 신규라 DELETE 불필요
  ];
  await db.batch(stmts);

  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  return json({ ok: true, event: eventDoc(row, tierIds) }, 201);
}

// 일정 수정
export async function update(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const row = await db.prepare('SELECT * FROM events WHERE id = ? AND owner = ?').bind(params.id, userId).first();
  if (!row) return fail('일정을 찾을 수 없습니다.', 404);

  const b = body || {};
  const next = {
    title: 'title' in b ? b.title : row.title,
    start: 'start' in b ? toIso(b.start) || row.start : row.start,
    end: 'end' in b ? toIso(b.end) || row.end : row.end,
    all_day: 'allDay' in b ? (b.allDay ? 1 : 0) : row.all_day,
    location: 'location' in b ? b.location || '' : row.location,
    memo: 'memo' in b ? b.memo || '' : row.memo,
    visibility: 'visibility' in b ? (b.visibility === 'private' ? 'private' : 'public') : row.visibility,
  };
  // 현재(또는 갱신된) 가시성이 private 이 아니면 대상 그룹은 비운다
  let tierIds = 'audienceTiers' in b ? normalizeAudience(b.audienceTiers) : null;
  if (next.visibility !== 'private') tierIds = [];

  const stmts = [
    db
      .prepare(
        `UPDATE events SET title = ?, start = ?, end = ?, all_day = ?, location = ?, memo = ?,
         visibility = ?, updated_at = ? WHERE id = ? AND owner = ?`
      )
      .bind(next.title, next.start, next.end, next.all_day, next.location, next.memo, next.visibility, nowIso(), params.id, userId),
  ];
  if (tierIds !== null) stmts.push(...(await audienceStatements(db, params.id, tierIds)));
  await db.batch(stmts);

  const updated = await db.prepare('SELECT * FROM events WHERE id = ?').bind(params.id).first();
  const audience = await loadAudience(db, [params.id]);
  return json({ ok: true, event: eventDoc(updated, audience[params.id] || []) });
}

// 일정 삭제
export async function remove(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const r = await env.DB.prepare('DELETE FROM events WHERE id = ? AND owner = ?').bind(params.id, userId).run();
  if (!r.meta.changes) return fail('일정을 찾을 수 없습니다.', 404);
  return json({ ok: true });
}
