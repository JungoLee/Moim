// 타인 캘린더 조회 — 공유(public)는 상세, 비공개(private)는 그룹 멤버에게만 상세, 그 외 "바쁨"
import { json, fail } from './http.js';
import { toIso, isId, groupBy, eventDoc, userBrief, rangeClause, areFriends } from './db.js';

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
  if (!from || !to || from > to) return fail('조회할 기간을 알 수 없어요.');
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

// 친구 한 명의 바쁜 시간 — 시간 요청을 보낼 때 "그 시간에 바쁜지" 경고용.
// 공개 범위 규칙: 친구에게만, 일정의 제목·장소·메모·공개 여부는 싣지 않고 시간만(비공개 일정도 "바쁨"으로는 이미 보인다).
export async function busyOf(request, env, params, body, userId) {
  const { userId: targetId } = params;
  if (!isId(targetId)) return fail('주소가 올바르지 않아요.');
  const url = new URL(request.url);
  const from = toIso(url.searchParams.get('from'));
  const to = toIso(url.searchParams.get('to'));
  if (!from || !to || from > to) return fail('조회할 기간을 알 수 없어요.');
  const db = env.DB;
  if (!(await areFriends(db, userId, targetId))) return fail('친구만 캘린더를 볼 수 있어요.', 403);
  const { results } = await db
    .prepare('SELECT start, end, all_day FROM events WHERE owner = ? AND start < ? AND end > ? ORDER BY start ASC LIMIT 100')
    .bind(targetId, to, from)
    .all();
  return json({ ok: true, busy: results.map((e) => ({ start: e.start, end: e.end, allDay: !!e.all_day })) });
}

export async function get(request, env, params, body, userId) {
  const { userId: targetId } = params;
  if (!isId(targetId)) return fail('주소가 올바르지 않아요.');
  const db = env.DB;
  const range = rangeClause(new URL(request.url));

  const ownerRow = await db.prepare('SELECT id, name, nickname, email, picture FROM users WHERE id = ?').bind(targetId).first();
  if (!ownerRow) return fail('사용자를 찾을 수 없어요.', 404);
  const owner = userBrief(ownerRow); // 닉네임 포함 — 화면은 닉네임을 먼저 쓴다

  const { results } = await db
    .prepare(`SELECT * FROM events WHERE owner = ?${range.sql} ORDER BY start ASC`)
    .bind(targetId, ...range.args)
    .all();

  // 본인 → 전체 상세 (기존 계약: Event 문서 원형을 그대로 반환)
  if (targetId === userId) {
    const audience = await audienceOf(db, targetId, false);
    return json({ ok: true, owner, relation: 'self', events: results.map((r) => eventDoc(r, audience[r.id] || [])) });
  }

  // 캘린더 열람 권한 = 친구 관계
  if (!(await areFriends(db, userId, targetId))) return fail('친구만 캘린더를 볼 수 있어요.', 403);

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
