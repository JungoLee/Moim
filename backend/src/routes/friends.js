import { Router } from 'express';
import mongoose from 'mongoose';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 내 친구 목록 (수락된 관계)
router.get('/', async (req, res) => {
  const me = req.userId;
  const list = await Friendship.find({ status: 'accepted', $or: [{ requester: me }, { recipient: me }] })
    .populate('requester', 'name email picture')
    .populate('recipient', 'name email picture');
  const friends = list.map((f) => {
    const iAmRequester = f.requester._id.toString() === me;
    const friend = iAmRequester ? f.recipient : f.requester;
    return { friendshipId: f._id, user: friend };
  });
  res.json({ ok: true, friends });
});

// 받은 친구 요청
router.get('/requests', async (req, res) => {
  const requests = await Friendship.find({ recipient: req.userId, status: 'pending' }).populate(
    'requester',
    'name email picture'
  );
  res.json({ ok: true, requests });
});

// 친구 요청 보내기 (이메일로)
router.post('/requests', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, message: 'email 이 필요합니다.' });
  const target = await User.findOne({ email });
  if (!target) return res.status(404).json({ ok: false, message: '해당 이메일의 사용자가 없습니다.' });
  if (target._id.toString() === req.userId) {
    return res.status(400).json({ ok: false, message: '자기 자신에게는 요청할 수 없습니다.' });
  }
  const existing = await Friendship.findOne({
    $or: [
      { requester: req.userId, recipient: target._id },
      { requester: target._id, recipient: req.userId },
    ],
  });
  if (existing) return res.status(409).json({ ok: false, message: '이미 친구이거나 요청이 진행 중입니다.' });
  const fs = await Friendship.create({ requester: req.userId, recipient: target._id, status: 'pending' });
  res.status(201).json({ ok: true, friendship: fs });
});

// 요청 수락
router.post('/requests/:id/accept', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const fs = await Friendship.findOne({ _id: req.params.id, recipient: req.userId, status: 'pending' });
  if (!fs) return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
  fs.status = 'accepted';
  await fs.save();
  res.json({ ok: true, friendship: fs });
});

// 요청 거절
router.post('/requests/:id/decline', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const r = await Friendship.deleteOne({ _id: req.params.id, recipient: req.userId, status: 'pending' });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
  res.json({ ok: true });
});

export default router;
