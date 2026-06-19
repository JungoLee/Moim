import { Router } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 내 일정 목록 (from/to 로 기간 필터)
router.get('/', async (req, res) => {
  const { from, to } = req.query;
  const q = { owner: req.userId };
  if (from || to) {
    q.start = {};
    if (from) q.start.$gte = new Date(from);
    if (to) q.start.$lte = new Date(to);
  }
  const events = await Event.find(q).sort({ start: 1 });
  res.json({ ok: true, events });
});

// 일정 생성
router.post('/', async (req, res) => {
  const { title, start, end, allDay, location, memo, visibility } = req.body;
  if (!title || !start || !end) {
    return res.status(400).json({ ok: false, message: 'title, start, end 는 필수입니다.' });
  }
  const event = await Event.create({
    owner: req.userId,
    title,
    start,
    end,
    allDay: !!allDay,
    location: location || '',
    memo: memo || '',
    visibility: visibility === 'private' ? 'private' : 'default',
  });
  res.status(201).json({ ok: true, event });
});

// 일정 수정
router.patch('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const event = await Event.findOne({ _id: req.params.id, owner: req.userId });
  if (!event) return res.status(404).json({ ok: false, message: '일정을 찾을 수 없습니다.' });
  for (const f of ['title', 'start', 'end', 'allDay', 'location', 'memo', 'visibility']) {
    if (f in req.body) event[f] = req.body[f];
  }
  await event.save();
  res.json({ ok: true, event });
});

// 일정 삭제
router.delete('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const r = await Event.deleteOne({ _id: req.params.id, owner: req.userId });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: '일정을 찾을 수 없습니다.' });
  res.json({ ok: true });
});

export default router;
