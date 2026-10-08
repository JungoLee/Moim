// 타인 캘린더 조회 — 공유(public)는 상세, 비공개(private)는 그룹 멤버에게만 상세, 그 외 "바쁨"
import { json, fail } from './http.js';
import { toIso, isId, groupBy, eventDoc, userBrief } from './db.js';

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

/** 한 사람의 일정 audienceTiers → { [eventId]: [tierId] }
 *  (일정 id 를 IN (?, …) 로 나열하면 D1 바인딩 100개 한도에 걸린다 — 소유자 조건 JOIN 으로) */
async function audienceOf(db, ownerId, privateOnly) {
  const { results } = await db
    .prepare(
      `SELECT a.event_id, a.tier_id FROM event_audience_tiers a
       JOIN events e ON e.id = a.event_id
       WHERE e.owner = ?${privateOnly ? " AND e.visibility = 'private'" : ''}`
    )
    .bind(ownerId)
    .all();
  return groupBy(results, 'event_id', 'tier_id');
}

// 친구 전원의 바쁜 시간 — 홈(표 테마) '이번 주 누가 언제 비나' 용.
// 공개 일정이라도 제목·장소·메모는 싣지 않는다(시간만). 기간은 겹치는 일정 전부(start <= to AND end >= from).
export async function friendsBusy(request, env, params, body, userId) {
  const url = new URL(request.url);
  const from = toIso(url.searchParams.get('from'));
  const to = toIso(url.searchParams.get('to'));
  if (!from || !to || from > to) return fail('from/to 가 필요합니다.');
  const db = env.DB;
  const friendIds = `SELECT recipient FROM friendships WHERE status = 'accepted' AND requester = ?
                     UNION SELECT requester FROM friendships WHERE status = 'accepted' AND recipient = ?`;
  const [{ results: friends }, { results: busy }] = await db.batch([
    db
      .prepare(`SELECT id, name, nickname, email, picture FROM users WHERE id IN (${friendIds}) ORDER BY nickname, name`)
      .bind(userId, userId),
    db
      .prepare(
        `SELECT owner, start, end, all_day FROM events
         WHERE owner IN (${friendIds}) AND start <= ? AND end >= ? ORDER BY start ASC`
      )
      .bind(userId, userId, to, from),
  ]);
  return json({
    ok: true,
    friends: friends.map(userBrief),
    busy: busy.map((e) => ({ userId: e.owner, start: e.start, end: e.end, allDay: !!e.all_day })),
  });
}

export async function get(request, env, params, body, userId) {
  const { userId: targetId } = params;
  if (!isId(targetId)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const url = new URL(request.url);
  const from = toIso(url.searchParams.get('from'));
  const to = toIso(url.searchParams.get('to'));

  const ownerRow = await db.prepare('SELECT id, name, nickname, email, picture FROM users WHERE id = ?').bind(targetId).first();
  if (!ownerRow) return fail('사용자를 찾을 수 없습니다.', 404);
  const owner = userBrief(ownerRow); // 닉네임 포함 — 화면은 닉네임을 먼저 쓴다

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
    const audience = await audienceOf(db, targetId, false);
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
  const audience = results.some((r) => r.visibility === 'private') ? await audienceOf(db, targetId, true) : {};

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
