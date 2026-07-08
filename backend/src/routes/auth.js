import { Router } from 'express';
import crypto from 'node:crypto';
import passport from 'passport';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdminEmail } from '../utils/admins.js';
import { sendLoginCode, hasMailTransport } from '../utils/mailer.js';
import User from '../models/User.js';
import LoginCode from '../models/LoginCode.js';
import Event from '../models/Event.js';
import Tier from '../models/Tier.js';
import Room from '../models/Room.js';
import Friendship from '../models/Friendship.js';

const router = Router();

// 1) 구글 로그인 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// 2) 구글 콜백 → JWT 발급 후 프론트로 리디렉션
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?error=auth`,
  }),
  (req, res) => {
    const token = signToken({ sub: req.user._id.toString() });
    const front = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${front}/auth/callback?token=${token}`);
  }
);

// ── 이메일 코드 로그인 (구글 계정 없이 아무 이메일로) ──────────────────────────
// 흐름: 이메일 입력 → 12자리 코드 발송 → 코드 입력 → JWT 발급.
// 같은 이메일의 기존 계정(구글 가입 포함)이 있으면 그 계정으로 로그인(메일함 소유 = 본인 증명).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 글자(I·L·O·0·1) 제외
const CODE_LEN = 12;
const CODE_TTL_MS = 10 * 60 * 1000; // 10분 (메일 발송 시)
const MANUAL_TTL_MS = 30 * 60 * 1000; // 30분 — TEMP(email-approval): 관리자 수동 전달 시 여유
const RESEND_COOLDOWN_MS = 60 * 1000; // 재전송 60초
const MAX_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LEN; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return code;
}

// 이메일로 인증 코드 발송
router.post('/email/request', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, message: '올바른 이메일을 입력해주세요.' });
  }
  const existing = await LoginCode.findOne({ email });
  if (existing && Date.now() - existing.sentAt.getTime() < RESEND_COOLDOWN_MS) {
    return res.status(429).json({ ok: false, message: '잠시 후 다시 요청해주세요. (1분에 1회)' });
  }
  const code = generateCode();
  // TEMP(email-approval): 발송 수단이 없으면 '관리자 수동 전달' 모드 —
  // 평문 코드를 보관해 관리자 페이지에 노출(관리자가 카톡 등으로 전달=승인), 유효시간은 30분으로 여유.
  const deliverable = hasMailTransport();
  const ttl = deliverable ? CODE_TTL_MS : MANUAL_TTL_MS;
  await LoginCode.findOneAndUpdate(
    { email },
    {
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + ttl),
      attempts: 0,
      sentAt: new Date(),
      code: deliverable ? '' : code,
    },
    { upsert: true }
  );
  try {
    await sendLoginCode(email, code); // 발송 수단 없으면 내부에서 콘솔 출력
  } catch (err) {
    console.error('[mail] 발송 실패:', err.message);
    return res.status(500).json({ ok: false, message: '메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
  res.json({ ok: true, manual: !deliverable });
});

// 코드 검증 → 로그인(JWT 발급). 계정이 없으면 새로 만든다.
router.post('/email/verify', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body.code === 'string' ? req.body.code.toUpperCase().replace(/[\s-]/g, '') : '';
  if (!EMAIL_RE.test(email) || !code) {
    return res.status(400).json({ ok: false, message: '이메일과 코드를 입력해주세요.' });
  }
  const entry = await LoginCode.findOne({ email });
  if (!entry || entry.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ ok: false, message: '코드가 만료됐어요. 다시 요청해주세요.' });
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    await LoginCode.deleteOne({ _id: entry._id });
    return res.status(400).json({ ok: false, message: '시도 횟수를 초과했어요. 코드를 다시 요청해주세요.' });
  }
  if (entry.codeHash !== hashCode(code)) {
    entry.attempts += 1;
    await entry.save();
    return res.status(400).json({ ok: false, message: `코드가 일치하지 않아요. (${MAX_ATTEMPTS - entry.attempts}회 남음)` });
  }
  await LoginCode.deleteOne({ _id: entry._id }); // 일회용

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      // googleId 는 스키마상 필수·유니크 — 이메일 가입자는 자리표시자로 채운다.
      // 이후 같은 이메일로 구글 로그인하면 passport 가 실제 googleId 로 교체(계정 통합).
      googleId: `email:${email}`,
      email,
      name: email.split('@')[0],
      isAdmin: isAdminEmail(email),
    });
  }
  res.json({ ok: true, token: signToken({ sub: user._id.toString() }) });
});

// 3) 내 정보
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('-__v');
  if (!user) return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
  res.json({ ok: true, user });
});

// 4) 내 프로필 수정 (닉네임)
router.patch('/me', requireAuth, async (req, res) => {
  const nickname = typeof req.body.nickname === 'string' ? req.body.nickname.trim().slice(0, 30) : '';
  const user = await User.findByIdAndUpdate(req.userId, { nickname }, { new: true }).select('-__v');
  if (!user) return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
  res.json({ ok: true, user });
});

// 5) 회원 탈퇴 — 내 데이터 정리 후 계정 삭제
router.delete('/me', requireAuth, async (req, res) => {
  const id = req.userId;
  await Promise.all([
    Event.deleteMany({ owner: id }),
    Tier.deleteMany({ owner: id }),
    Room.deleteMany({ owner: id }),
    Tier.updateMany({}, { $pull: { members: id } }),
    Room.updateMany({}, { $pull: { members: id, availabilities: { user: id }, comments: { user: id } } }),
    Friendship.deleteMany({ $or: [{ requester: id }, { recipient: id }] }),
  ]);
  await User.deleteOne({ _id: id });
  res.json({ ok: true });
});

// ── 연차 계산기 설정 (사용자별 유지 + 갱신일 자동 이월) ──────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
// 한국(KST) 기준 오늘 (서버가 UTC여도 동일하게 동작)
function kstToday() {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())}`;
}
function addOneYear(ymd) {
  if (!ymd) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y + 1, m - 1, d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
// 갱신일이 오늘 이하면 시작일·갱신일을 1년씩 미뤄 다음 주기로 이월. 바뀌면 true.
function rollForward(leave) {
  const today = kstToday();
  let changed = false;
  // 'YYYY-MM-DD' 는 사전순 비교 == 날짜순 비교
  while (leave.renewal && leave.renewal <= today) {
    leave.start = addOneYear(leave.start);
    leave.renewal = addOneYear(leave.renewal);
    changed = true;
  }
  return changed;
}

// 내 연차 설정 조회 (조회 시점에 갱신일 자동 이월)
router.get('/leave', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
  if (!user.leave) user.leave = {}; // 이 필드 이전에 가입한 사용자 대비
  if (rollForward(user.leave)) {
    user.markModified('leave');
    await user.save();
  }
  res.json({ ok: true, leave: user.leave });
});

// 내 연차 설정 저장
router.put('/leave', requireAuth, async (req, res) => {
  const b = req.body || {};
  const styles = ['short', 'balanced', 'long'];
  const leave = {
    remaining: Number.isFinite(+b.remaining) ? +b.remaining : 15,
    start: typeof b.start === 'string' ? b.start.slice(0, 10) : '',
    renewal: typeof b.renewal === 'string' ? b.renewal.slice(0, 10) : '',
    maxConsec: Number.isFinite(+b.maxConsec) ? Math.min(20, Math.max(1, Math.trunc(+b.maxConsec))) : 5,
    style: styles.includes(b.style) ? b.style : 'balanced',
  };
  rollForward(leave);
  const user = await User.findByIdAndUpdate(req.userId, { leave }, { new: true }).select('-__v');
  if (!user) return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
  res.json({ ok: true, leave: user.leave });
});

export default router;
