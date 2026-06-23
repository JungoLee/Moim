import { Router } from 'express';
import passport from 'passport';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import User from '../models/User.js';
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
