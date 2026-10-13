// D1 공용 헬퍼 — id 생성·시각 정규화·여러 라우트가 같이 쓰는 조회·행 → (기존 Mongo 문서 형태) 변환
// 프론트 계약을 그대로 유지하기 위해 응답은 _id / camelCase / 중첩 객체로 되조립한다.

/** 신규 id. 기존 데이터는 Mongo ObjectId(24-hex)를 그대로 승계하므로 둘이 공존한다. */
export const newId = () => crypto.randomUUID();

export const nowIso = () => new Date().toISOString();

/** 한국(KST) 기준 오늘 'YYYY-MM-DD' (서버가 UTC 여도 같다) — 연차 이월·모임 진행 상태 공용 */
export function kstToday() {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return k.toISOString().slice(0, 10);
}

/** 입력 날짜(ISO 문자열·'YYYY-MM-DD' 등) → ISO8601 UTC 정규화. 실패하면 null */
export function toIso(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 경로/본문으로 들어온 id 형식 검증 (기존 ObjectId.isValid 자리) */
export function isId(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9_-]+$/.test(v);
}

/** IN (?,?,?) 절 — 빈 배열이면 호출 측에서 건너뛸 것 */
export const placeholders = (n) => Array(n).fill('?').join(',');

/** 일정 기간 필터(?from&to)를 WHERE 절 조각으로 — 내 일정·친구 캘린더 공용 */
export function rangeClause(url) {
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

/** 두 사람이 친구(수락됨)인가 — 캘린더 열람·시간 요청 권한 공용 */
export async function areFriends(db, a, b) {
  const row = await db
    .prepare(
      `SELECT 1 FROM friendships WHERE status = 'accepted'
       AND ((requester = ? AND recipient = ?) OR (requester = ? AND recipient = ?))`
    )
    .bind(a, b, b, a)
    .first();
  return !!row;
}

/** 그룹핑: [{event_id, tier_id}] → { [event_id]: [tier_id] } */
export function groupBy(rows, keyCol, valCol) {
  const out = {};
  for (const r of rows) (out[r[keyCol]] ||= []).push(r[valCol]);
  return out;
}

// ── 행 → 문서 변환 ──────────────────────────────────────────────

export function userDoc(row) {
  if (!row) return null;
  return {
    _id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    nickname: row.nickname,
    picture: row.picture,
    isAdmin: !!row.is_admin,
    uiTheme: row.ui_theme || '',
    leave: {
      remaining: row.leave_remaining,
      start: row.leave_start,
      renewal: row.leave_renewal,
      maxConsec: row.leave_max_consec,
      style: row.leave_style,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 친구/멤버 목록에 실리는 축약 사용자 */
export function userBrief(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    nickname: row.nickname,
    email: row.email,
    picture: row.picture,
  };
}

export function eventDoc(row, audienceTiers = []) {
  const doc = {
    _id: row.id,
    owner: row.owner,
    title: row.title,
    start: row.start,
    end: row.end,
    allDay: !!row.all_day,
    location: row.location,
    memo: row.memo,
    visibility: row.visibility,
    audienceTiers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  // origin 은 시간 요청 출신 일정에만 (기존에도 없으면 빈 객체였다)
  doc.origin = {
    kind: row.origin_kind || '',
    requestId: row.origin_request_id || undefined,
    fromName: row.origin_from_name || '',
    toName: row.origin_to_name || '',
    requestedAt: row.origin_requested_at || undefined,
  };
  return doc;
}

export function tierDoc(row, members = []) {
  return {
    _id: row.id,
    owner: row.owner,
    name: row.name,
    code: row.code,
    color: row.color,
    members,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function timeRequestDoc(row, from = null, to = null) {
  return {
    _id: row.id,
    from: from || row.from_user,
    to: to || row.to_user,
    title: row.title,
    start: row.start,
    end: row.end,
    allDay: !!row.all_day,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
