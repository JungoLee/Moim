// 타인 캘린더 조회 — 공유(public)는 상세, 비공개(private)는 그룹 멤버에게만 상세, 그 외 "바쁨"
import { json, fail } from './http.js';
import { toIso, isId, placeholders, groupBy, eventDoc } from './db.js';

// 일정을 상세(detail)로 변환
function toDetail(e) {
  return {
    _id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: !!e.all_day,
    location: e.location,
    memo: e.memo,
    visibility: e.visibility,
    busy: false,
  };
}

// 일정을 "바쁨" 블록으로 변환 (제목·장소·메모는 절대 노출하지 않는다)
function toBusy(e) {
  return { _id: e.id, start: e.start, end: e.end, allDay: !!e.all_day, busy: true };
}

export async function get(request, env, params, body, userId) {
  const { userId: targetId } = params;
  if (!isId(targetId)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const url = new URL(request.url);
  const from = toIso(url.searchParams.get('from'));
  const to = toIso(url.searchParams.get('to'));

  const ownerRow = await db.prepare('SELECT id, name, email, picture FROM users WHERE id = ?').bind(targetId).first();
  if (!ownerRow) return fail('사용자를 찾을 수 없습니다.', 404);
  const owner = { _id: ownerRow.id, name: ownerRow.name, email: ownerRow.email, picture: ownerRow.picture };

  let sql = 'SELECT * FROM events WHERE owner = ?';
  const args = [targetId];
  if (from) {
    sql += ' AND start >= ?';
    args.push(from);
  }
  if (to) {
    sql += ' AND start <= ?';
    args.push(to);
  }
  sql += ' ORDER BY start ASC';
  const { results } = await db.prepare(sql).bind(...args).all();

  // 본인 → 전체 상세 (기존 계약: Event 문서 원형을 그대로 반환)
  if (targetId === userId) {
    const ids = results.map((r) => r.id);
    let audience = {};
    if (ids.length) {
      const { results: at } = await db
        .prepare(`SELECT event_id, tier_id FROM event_audience_tiers WHERE event_id IN (${placeholders(ids.length)})`)
        .bind(...ids)
        .all();
      audience = groupBy(at, 'event_id', 'tier_id');
    }
    return json({ ok: true, owner, relation: 'self', events: results.map((r) => eventDoc(r, audience[r.id] || [])) });
  }

  // 캘린더 열람 권한 = 친구 관계
  const fs = await db
    .prepare(
      `SELECT id FROM friendships WHERE status = 'accepted'
       AND ((requester = ? AND recipient = ?) OR (requester = ? AND recipient = ?))`
    )
    .bind(userId, targetId, targetId, userId)
    .first();
  if (!fs) return fail('이 사용자의 캘린더를 볼 권한이 없습니다.', 403);

  // owner 의 그룹 중 내가 멤버인 것들 → 비공개 일정 상세 열람 가능
  const { results: myTiers } = await db
    .prepare(
      `SELECT t.id FROM tiers t JOIN tier_members m ON m.tier_id = t.id
       WHERE t.owner = ? AND m.user_id = ?`
    )
    .bind(targetId, userId)
    .all();
  const myTierIds = new Set(myTiers.map((t) => t.id));

  // 비공개 일정의 대상 그룹
  const privateIds = results.filter((r) => r.visibility === 'private').map((r) => r.id);
  let audience = {};
  if (privateIds.length) {
    const { results: at } = await db
      .prepare(`SELECT event_id, tier_id FROM event_audience_tiers WHERE event_id IN (${placeholders(privateIds.length)})`)
      .bind(...privateIds)
      .all();
    audience = groupBy(at, 'event_id', 'tier_id');
  }

  const events = results.map((e) => {
    if (e.visibility === 'private') {
      const allowed = (audience[e.id] || []).some((tid) => myTierIds.has(tid));
      return allowed ? toDetail(e) : toBusy(e);
    }
    // public / default → 상세
    return toDetail(e);
  });

  return json({ ok: true, owner, relation: 'friend', events });
}
