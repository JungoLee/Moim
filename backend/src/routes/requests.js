import { Router } from 'express';
import mongoose from 'mongoose';
import TimeRequest from '../models/TimeRequest.js';
import Friendship from '../models/Friendship.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const POPULATE = 'name nickname email picture';

async function areFriends(a, b) {
  return !!(await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: a, recipient: b },
      { requester: b, recipient: a },
    ],
  }));
}

// 받은 시간 요청
router.get('/received', async (req, res) => {
  const requests = await TimeRequest.find({ to: req.userId }).populate('from', POPULATE).sort({ createdAt: -1 });
  res.json({ ok: true, requests });
});

// 보낸 시간 요청
router.get('/sent', async (req, res) => {
  const requests = await TimeRequest.find({ from: req.userId }).populate('to', POPULATE).sort({ createdAt: -1 });
  res.json({ ok: true, requests });
});

// 요청 보내기
router.post('/', async (req, res) => {
  const { to, start, end, title, message, allDay } = req.body;
  if (!mongoose.Types.ObjectId.isValid(to)) return res.status(400).json({ ok: false, message: '대상이 올바르지 않습니다.' });
  if (to === req.userId) return res.status(400).json({ ok: false, message: '본인에게는 요청할 수 없습니다.' });
  if (!start || !end) return res.status(400).json({ ok: false, message: '시작/종료 시간이 필요합니다.' });
  if (!(await areFriends(req.userId, to))) {
    return res.status(403).json({ ok: false, message: '친구에게만 시간 요청을 보낼 수 있습니다.' });
  }
  const request = await TimeRequest.create({
    from: req.userId,
    to,
    start,
    end,
    allDay: !!allDay,
    title: (title || '').trim() || '시간 요청',
    message: (message || '').trim(),
  });
  res.status(201).json({ ok: true, request });
});

// 수락 → 양쪽 캘린더에 일정 자동 생성
router.post('/:id/accept', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const tr = await TimeRequest.findOne({ _id: req.params.id, to: req.userId, status: 'pending' });
  if (!tr) return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
  tr.status = 'accepted';
  await tr.save();
  // 일정 클릭 시 "누가 언제 요청했는지" 보이도록 출처를 스냅샷으로 남긴다
  const [fromUser, toUser] = await Promise.all([User.findById(tr.from), User.findById(tr.to)]);
  const label = (u) => (u && (u.nickname || u.name || u.email)) || '알 수 없음';
  const origin = { kind: 'timeRequest', fromName: label(fromUser), toName: label(toUser), requestedAt: tr.createdAt };
  const base = { title: tr.title, start: tr.start, end: tr.end, allDay: tr.allDay, visibility: 'public', origin };
  await Event.create([
    { ...base, owner: tr.to },
    { ...base, owner: tr.from },
  ]);
  res.json({ ok: true });
});

// 거절
router.post('/:id/decline', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const tr = await TimeRequest.findOneAndUpdate(
    { _id: req.params.id, to: req.userId, status: 'pending' },
    { status: 'declined' },
    { new: true }
  );
  if (!tr) return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
  res.json({ ok: true });
});

// 보낸 요청 취소(대기중만)
router.delete('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const r = await TimeRequest.deleteOne({ _id: req.params.id, from: req.userId, status: 'pending' });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: '취소할 요청을 찾을 수 없습니다.' });
  res.json({ ok: true });
});

export default router;
