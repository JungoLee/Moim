import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import LoginCode from '../models/LoginCode.js';
import Event from '../models/Event.js';
import Tier from '../models/Tier.js';
import Room from '../models/Room.js';
import Friendship from '../models/Friendship.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const valid = (id) => mongoose.Types.ObjectId.isValid(id);

// 통계 개요
router.get('/stats', async (req, res) => {
  const [users, admins, events, tiers, rooms, friendships] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isAdmin: true }),
    Event.countDocuments(),
    Tier.countDocuments(),
    Room.countDocuments(),
    Friendship.countDocuments(),
  ]);
  res.json({ ok: true, stats: { users, admins, events, tiers, rooms, friendships } });
});

// TEMP(email-approval): 이메일 로그인 코드 대기 목록 — 발송 수단(Brevo/SMTP)이 없는 동안
// 관리자가 코드를 확인해 본인에게 직접 전달(승인)하는 임시 운영용.
// 발송 수단 설정 후엔 평문(code)이 저장되지 않아 항상 빈 배열 → 이 라우트·admin 페이지 섹션 제거 가능.
router.get('/login-codes', async (req, res) => {
  const codes = await LoginCode.find({ code: { $ne: '' }, expiresAt: { $gt: new Date() } })
    .select('email code expiresAt sentAt')
    .sort({ sentAt: -1 });
  res.json({ ok: true, codes });
});

// 가입자 목록
router.get('/users', async (req, res) => {
  const users = await User.find().select('name nickname email picture isAdmin createdAt').sort({ createdAt: 1 });
  res.json({ ok: true, users });
});

// 관리자 권한 부여/회수
router.patch('/users/:id/admin', async (req, res) => {
  if (!valid(req.params.id)) return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  const isAdmin = !!req.body.isAdmin;
  if (req.params.id === req.userId && !isAdmin) {
    return res.status(400).json({ ok: false, message: '본인의 관리자 권한은 회수할 수 없습니다.' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isAdmin }, { new: true }).select('name email isAdmin');
  if (!user) return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
  res.json({ ok: true, user });
});

// 회원 삭제(탈퇴 처리) — 관련 데이터 정리(cascade)
router.delete('/users/:id', async (req, res) => {
  if (!valid(req.params.id)) return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  if (req.params.id === req.userId) return res.status(400).json({ ok: false, message: '본인 계정은 삭제할 수 없습니다.' });
  const id = req.params.id;
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

// 모든 모임 (모더레이션)
router.get('/rooms', async (req, res) => {
  const rooms = await Room.find().populate('owner', 'name email').sort({ createdAt: -1 });
  res.json({
    ok: true,
    rooms: rooms.map((r) => ({
      _id: r._id,
      name: r.name,
      code: r.code,
      memberCount: r.members.length,
      owner: r.owner ? r.owner.name || r.owner.email : '-',
      createdAt: r.createdAt,
    })),
  });
});
router.delete('/rooms/:id', async (req, res) => {
  if (!valid(req.params.id)) return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  const r = await Room.deleteOne({ _id: req.params.id });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: '모임을 찾을 수 없습니다.' });
  res.json({ ok: true });
});

// 모든 그룹 (모더레이션)
router.get('/tiers', async (req, res) => {
  const tiers = await Tier.find().populate('owner', 'name email').sort({ createdAt: -1 });
  res.json({
    ok: true,
    tiers: tiers.map((t) => ({
      _id: t._id,
      name: t.name,
      code: t.code,
      memberCount: t.members.length,
      owner: t.owner ? t.owner.name || t.owner.email : '-',
      createdAt: t.createdAt,
    })),
  });
});
router.delete('/tiers/:id', async (req, res) => {
  if (!valid(req.params.id)) return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  const r = await Tier.deleteOne({ _id: req.params.id });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: '그룹을 찾을 수 없습니다.' });
  res.json({ ok: true });
});

export default router;
