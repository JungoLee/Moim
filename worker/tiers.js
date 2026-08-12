// 그룹(Tier) — 일정 비공개 시 상세를 볼 수 있는 사용자 묶음
import { json, fail } from './http.js';
import { newId, nowIso, isId, placeholders, userBrief, tierDoc } from './db.js';

const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** 충돌 없는 짧은 코드 생성 (대문자+숫자 8자리) */
export async function generateUniqueCode(db, table) {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 8; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = [...bytes].map((b) => CHARS[b % CHARS.length]).join('');
    const taken = await db.prepare(`SELECT 1 FROM ${table} WHERE code = ?`).bind(code).first();
    if (!taken) return code;
  }
  // 극히 드문 실패 시 랜덤 hex 폴백
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// 내 그룹 목록 (멤버 정보 포함)
export async function list(request, env, params, body, userId) {
  const db = env.DB;
  const { results: tiers } = await db
    .prepare('SELECT * FROM tiers WHERE owner = ? ORDER BY created_at ASC')
    .bind(userId)
    .all();
  if (!tiers.length) return json({ ok: true, tiers: [] });

  const ids = tiers.map((t) => t.id);
  const { results: members } = await db
    .prepare(
      `SELECT m.tier_id, u.id, u.name, u.nickname, u.email, u.picture
       FROM tier_members m JOIN users u ON u.id = m.user_id
       WHERE m.tier_id IN (${placeholders(ids.length)})`
    )
    .bind(...ids)
    .all();
  const byTier = {};
  for (const m of members) (byTier[m.tier_id] ||= []).push(userBrief(m));

  return json({ ok: true, tiers: tiers.map((t) => tierDoc(t, byTier[t.id] || [])) });
}

// 그룹 생성
export async function create(request, env, params, body, userId) {
  const { name, color } = body || {};
  if (!name || !name.trim()) return fail('name 이 필요합니다.');
  // 색상은 #rrggbb / #rgb 형식만 허용, 아니면 기본값
  const safeColor = typeof color === 'string' && COLOR_RE.test(color) ? color : '#7c8cff';
  const db = env.DB;
  const id = newId();
  const ts = nowIso();
  const code = await generateUniqueCode(db, 'tiers');
  await db
    .prepare('INSERT INTO tiers (id, owner, name, code, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, name.trim(), code, safeColor, ts, ts)
    .run();
  const row = await db.prepare('SELECT * FROM tiers WHERE id = ?').bind(id).first();
  return json({ ok: true, tier: tierDoc(row, []) }, 201);
}

// 그룹 색상 변경 (본인 소유만)
export async function update(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const color = body?.color;
  if (typeof color !== 'string' || !COLOR_RE.test(color)) {
    return fail('색상 형식이 올바르지 않습니다. (#rrggbb)');
  }
  const db = env.DB;
  const r = await db
    .prepare('UPDATE tiers SET color = ?, updated_at = ? WHERE id = ? AND owner = ?')
    .bind(color, nowIso(), params.id, userId)
    .run();
  if (!r.meta.changes) return fail('그룹을 찾을 수 없습니다.', 404);
  const row = await db.prepare('SELECT * FROM tiers WHERE id = ?').bind(params.id).first();
  return json({ ok: true, tier: tierDoc(row, []) });
}

// 그룹 삭제
export async function remove(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const r = await env.DB.prepare('DELETE FROM tiers WHERE id = ? AND owner = ?').bind(params.id, userId).run();
  if (!r.meta.changes) return fail('그룹을 찾을 수 없습니다.', 404);
  return json({ ok: true });
}

// 멤버 추가 (이메일로)
export async function addMember(request, env, params, body, userId) {
  if (!isId(params.id)) return fail('잘못된 id 입니다.');
  const email = body?.email;
  if (!email) return fail('email 이 필요합니다.');
  const db = env.DB;
  const tier = await db.prepare('SELECT id FROM tiers WHERE id = ? AND owner = ?').bind(params.id, userId).first();
  if (!tier) return fail('그룹을 찾을 수 없습니다.', 404);
  const target = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!target) return fail('해당 이메일의 사용자가 없습니다.', 404);
  const dup = await db
    .prepare('SELECT 1 FROM tier_members WHERE tier_id = ? AND user_id = ?')
    .bind(params.id, target.id)
    .first();
  if (dup) return fail('이미 그룹에 포함된 사용자입니다.', 409);
  await db.prepare('INSERT INTO tier_members (tier_id, user_id) VALUES (?, ?)').bind(params.id, target.id).run();
  return json({ ok: true });
}

// 멤버 제거
export async function removeMember(request, env, params, body, userId) {
  const { id, userId: memberId } = params;
  if (!isId(id) || !isId(memberId)) return fail('잘못된 id 입니다.');
  const db = env.DB;
  const tier = await db.prepare('SELECT id FROM tiers WHERE id = ? AND owner = ?').bind(id, userId).first();
  if (!tier) return fail('그룹을 찾을 수 없습니다.', 404);
  await db.prepare('DELETE FROM tier_members WHERE tier_id = ? AND user_id = ?').bind(id, memberId).run();
  return json({ ok: true });
}

// 코드로 그룹 가입 (내가 멤버로 들어감)
export async function join(request, env, params, body, userId) {
  const code = body?.code;
  if (!code) return fail('code 가 필요합니다.');
  const db = env.DB;
  const tier = await db.prepare('SELECT * FROM tiers WHERE code = ?').bind(code.trim().toUpperCase()).first();
  if (!tier) return fail('해당 코드의 그룹이 없습니다.', 404);
  if (tier.owner === userId) return fail('본인 그룹에는 가입할 수 없습니다.');
  const dup = await db
    .prepare('SELECT 1 FROM tier_members WHERE tier_id = ? AND user_id = ?')
    .bind(tier.id, userId)
    .first();
  if (dup) return fail('이미 가입한 그룹입니다.', 409);
  await db.prepare('INSERT INTO tier_members (tier_id, user_id) VALUES (?, ?)').bind(tier.id, userId).run();
  return json({ ok: true, tierName: tier.name });
}
