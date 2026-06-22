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

export default router;
