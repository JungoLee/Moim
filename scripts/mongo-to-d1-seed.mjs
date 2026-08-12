// backup/*.json (Mongo 백업) → worker/seed.sql (D1 INSERT 문) 생성
// 사용: node scripts/mongo-to-d1-seed.mjs
//   적용: npx wrangler d1 execute moim --local  --file worker/seed.sql
//         npx wrangler d1 execute moim --remote --file worker/seed.sql
// seed.sql 은 개인 데이터라 gitignore 대상 — 커밋 금지
//
// 설계 메모
// - Mongo ObjectId(24-hex)를 D1 의 TEXT PK 로 그대로 승계한다 → 기존 JWT(sub=ObjectId)가 계속 유효.
// - 날짜는 전부 ISO8601 UTC 문자열로 정규화한다.
// - FK(ON DELETE CASCADE)가 걸려 있으므로 부모(users) → 자식 순서로 INSERT 하고,
//   참조 대상이 사라진 고아 문서는 건너뛴다(건수를 리포트).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupDir = path.join(root, 'backup');

function read(name) {
  const file = path.join(backupDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`  (없음) backup/${name}.json — 건너뜀`);
    return [];
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── 값 변환 ────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const bool = (v) => (v ? 1 : 0);
const str = (v) => (typeof v === 'string' ? v : '');

/** Mongo 확장 JSON / Date / ISO 문자열 → ISO8601 UTC. 없으면 null */
function iso(v) {
  if (!v) return null;
  const raw = typeof v === 'object' ? v.$date ?? v : v;
  const d = new Date(typeof raw === 'object' ? raw.$numberLong ?? raw : raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ObjectId 표현( '...' | {$oid} | {_id} ) → 24-hex 문자열 */
function oid(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.$oid || (v._id ? oid(v._id) : null);
  return null;
}

const lines = ['-- 자동 생성: Mongo 백업 → D1 (개인 데이터, 커밋 금지)', 'PRAGMA defer_foreign_keys = TRUE;'];
const stat = {};
const skipped = {};
const add = (name, sql) => {
  lines.push(sql);
  stat[name] = (stat[name] || 0) + 1;
};
const skip = (name) => (skipped[name] = (skipped[name] || 0) + 1);

// 기존 데이터 제거 (재실행 가능) — 자식부터
for (const t of [
  'event_audience_tiers', 'room_availability_marks', 'room_comments', 'room_members',
  'tier_members', 'events', 'rooms', 'tiers', 'friendships', 'time_requests', 'login_codes', 'users',
]) {
  lines.push(`DELETE FROM ${t};`);
}

// ── users ─────────────────────────────────────────────────────
const users = read('users');
const userIds = new Set();
for (const u of users) {
  const id = oid(u._id);
  const googleId = str(u.googleId);
  if (!id || !googleId) {
    skip('users');
    continue;
  }
  userIds.add(id);
  const lv = u.leave || {};
  const ts = iso(u.createdAt) || new Date().toISOString();
  add(
    'users',
    `INSERT INTO users (id, google_id, email, name, nickname, picture, is_admin,
       leave_remaining, leave_start, leave_renewal, leave_max_consec, leave_style, created_at, updated_at)
     VALUES (${q(id)}, ${q(googleId)}, ${q(str(u.email))}, ${q(str(u.name))}, ${q(str(u.nickname))},
       ${q(str(u.picture))}, ${bool(u.isAdmin)}, ${num(lv.remaining, 15)}, ${q(str(lv.start))},
       ${q(str(lv.renewal))}, ${num(lv.maxConsec, 5)}, ${q(str(lv.style) || 'balanced')},
       ${q(ts)}, ${q(iso(u.updatedAt) || ts)});`
  );
}
const hasUser = (id) => id && userIds.has(id);

// ── tiers (+ tier_members) ────────────────────────────────────
const tiers = read('tiers');
const tierIds = new Set();
const usedTierCodes = new Set();
for (const t of tiers) {
  const id = oid(t._id);
  const owner = oid(t.owner);
  if (!id || !hasUser(owner) || !t.code || usedTierCodes.has(t.code)) {
    skip('tiers');
    continue;
  }
  usedTierCodes.add(t.code);
  tierIds.add(id);
  const ts = iso(t.createdAt) || new Date().toISOString();
  add(
    'tiers',
    `INSERT INTO tiers (id, owner, name, code, color, created_at, updated_at)
     VALUES (${q(id)}, ${q(owner)}, ${q(str(t.name))}, ${q(str(t.code))},
       ${q(str(t.color) || '#7c8cff')}, ${q(ts)}, ${q(iso(t.updatedAt) || ts)});`
  );
  const seen = new Set();
  for (const m of t.members || []) {
    const uid = oid(m);
    if (!hasUser(uid) || seen.has(uid)) continue;
    seen.add(uid);
    add('tier_members', `INSERT INTO tier_members (tier_id, user_id) VALUES (${q(id)}, ${q(uid)});`);
  }
}

// ── rooms (+ members / marks / comments) ──────────────────────
const rooms = read('rooms');
const usedRoomCodes = new Set();
for (const r of rooms) {
  const id = oid(r._id);
  const owner = oid(r.owner);
  if (!id || !hasUser(owner) || !r.code || usedRoomCodes.has(r.code)) {
    skip('rooms');
    continue;
  }
  usedRoomCodes.add(r.code);
  const ts = iso(r.createdAt) || new Date().toISOString();
  add(
    'rooms',
    `INSERT INTO rooms (id, owner, name, code, join_by_url, created_at, updated_at)
     VALUES (${q(id)}, ${q(owner)}, ${q(str(r.name))}, ${q(str(r.code))}, ${bool(r.joinByUrl)},
       ${q(ts)}, ${q(iso(r.updatedAt) || ts)});`
  );

  const seen = new Set();
  for (const m of r.members || []) {
    const uid = oid(m);
    if (!hasUser(uid) || seen.has(uid)) continue;
    seen.add(uid);
    add('room_members', `INSERT INTO room_members (room_id, user_id) VALUES (${q(id)}, ${q(uid)});`);
  }

  // availabilities[].marks[] → 평탄화 (room_id+user_id+date 가 PK 라 중복 제거)
  for (const a of r.availabilities || []) {
    const uid = oid(a.user);
    if (!hasUser(uid)) continue;
    const dates = new Set();
    for (const mk of a.marks || []) {
      const date = str(mk.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dates.has(date)) continue;
      dates.add(date);
      const status = ['yes', 'no', 'after'].includes(mk.status) ? mk.status : 'yes';
      add(
        'room_availability_marks',
        `INSERT INTO room_availability_marks (room_id, user_id, date, status, time)
         VALUES (${q(id)}, ${q(uid)}, ${q(date)}, ${q(status)}, ${q(str(mk.time))});`
      );
    }
  }

  for (const c of r.comments || []) {
    const cid = oid(c._id);
    const uid = oid(c.user);
    if (!cid || !hasUser(uid) || !c.text) continue;
    add(
      'room_comments',
      `INSERT INTO room_comments (id, room_id, user_id, author_name, text, created_at)
       VALUES (${q(cid)}, ${q(id)}, ${q(uid)}, ${q(str(c.name))}, ${q(str(c.text))},
         ${q(iso(c.createdAt) || ts)});`
    );
  }
}

// ── events (+ event_audience_tiers) ───────────────────────────
for (const e of read('events')) {
  const id = oid(e._id);
  const owner = oid(e.owner);
  const start = iso(e.start);
  const end = iso(e.end);
  if (!id || !hasUser(owner) || !start || !end) {
    skip('events');
    continue;
  }
  const o = e.origin || {};
  const ts = iso(e.createdAt) || start;
  const visibility = ['public', 'private', 'default'].includes(e.visibility) ? e.visibility : 'public';
  add(
    'events',
    `INSERT INTO events (id, owner, title, start, end, all_day, location, memo, visibility,
       origin_kind, origin_request_id, origin_from_name, origin_to_name, origin_requested_at, created_at, updated_at)
     VALUES (${q(id)}, ${q(owner)}, ${q(str(e.title))}, ${q(start)}, ${q(end)}, ${bool(e.allDay)},
       ${q(str(e.location))}, ${q(str(e.memo))}, ${q(visibility)},
       ${q(str(o.kind))}, ${q(oid(o.requestId))}, ${q(str(o.fromName))}, ${q(str(o.toName))},
       ${q(iso(o.requestedAt))}, ${q(ts)}, ${q(iso(e.updatedAt) || ts)});`
  );
  const seen = new Set();
  for (const t of e.audienceTiers || []) {
    const tid = oid(t);
    if (!tid || !tierIds.has(tid) || seen.has(tid)) continue;
    seen.add(tid);
    add(
      'event_audience_tiers',
      `INSERT INTO event_audience_tiers (event_id, tier_id) VALUES (${q(id)}, ${q(tid)});`
    );
  }
}

// ── friendships ───────────────────────────────────────────────
const pairs = new Set();
for (const f of read('friendships')) {
  const id = oid(f._id);
  const a = oid(f.requester);
  const b = oid(f.recipient);
  const key = `${a}|${b}`;
  if (!id || !hasUser(a) || !hasUser(b) || pairs.has(key)) {
    skip('friendships');
    continue;
  }
  pairs.add(key);
  const ts = iso(f.createdAt) || new Date().toISOString();
  add(
    'friendships',
    `INSERT INTO friendships (id, requester, recipient, status, created_at, updated_at)
     VALUES (${q(id)}, ${q(a)}, ${q(b)}, ${q(f.status === 'accepted' ? 'accepted' : 'pending')},
       ${q(ts)}, ${q(iso(f.updatedAt) || ts)});`
  );
}

// ── time_requests ─────────────────────────────────────────────
for (const t of read('timerequests')) {
  const id = oid(t._id);
  const from = oid(t.from);
  const to = oid(t.to);
  const start = iso(t.start);
  const end = iso(t.end);
  if (!id || !hasUser(from) || !hasUser(to) || !start || !end) {
    skip('time_requests');
    continue;
  }
  const ts = iso(t.createdAt) || start;
  const status = ['pending', 'accepted', 'declined'].includes(t.status) ? t.status : 'pending';
  add(
    'time_requests',
    `INSERT INTO time_requests (id, from_user, to_user, title, start, end, all_day, message, status, created_at, updated_at)
     VALUES (${q(id)}, ${q(from)}, ${q(to)}, ${q(str(t.title) || '시간 요청')}, ${q(start)}, ${q(end)},
       ${bool(t.allDay)}, ${q(str(t.message))}, ${q(status)}, ${q(ts)}, ${q(iso(t.updatedAt) || ts)});`
  );
}

// login_codes 는 일회용·10분 만료라 이전하지 않는다.

const outFile = path.join(root, 'worker', 'seed.sql');
fs.writeFileSync(outFile, lines.join('\n') + '\n');
console.log('seed.sql 생성 완료 →', outFile);
console.log('  삽입:', stat);
if (Object.keys(skipped).length) console.log('  건너뜀(고아·중복):', skipped);
