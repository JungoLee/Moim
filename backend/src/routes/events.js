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
  // 시간 요청 일정: 상대방 사본이 아직 살아있는지 표시 (삭제됐으면 클릭 시 안내용)
  const reqIds = [
    ...new Set(
      events
        .filter((e) => e.origin?.kind === 'timeRequest' && e.origin.requestId)
        .map((e) => e.origin.requestId.toString())
    ),
  ];
  let alive = new Set();
  if (reqIds.length) {
    const partners = await Event.find({ 'origin.requestId': { $in: reqIds }, owner: { $ne: req.userId } }).select(
      'origin.requestId'
    );
    alive = new Set(partners.map((p) => p.origin.requestId.toString()));
  }
  const out = events.map((e) => {
    const o = e.toObject();
    if (o.origin?.kind === 'timeRequest' && o.origin.requestId) {
      o.originPartnerGone = !alive.has(o.origin.requestId.toString());
    }
    return o;
  });
  res.json({ ok: true, events: out });
});

// 비공개 일정의 audienceTiers 입력 정규화 (유효한 ObjectId 배열만)
function normalizeAudience(audienceTiers) {
  if (!Array.isArray(audienceTiers)) return [];
  return audienceTiers.filter((id) => mongoose.Types.ObjectId.isValid(id));
}

// 일정 생성
router.post('/', async (req, res) => {
  const { title, start, end, allDay, location, memo, visibility, audienceTiers } = req.body;
  if (!title || !start || !end) {
    return res.status(400).json({ ok: false, message: 'title, start, end 는 필수입니다.' });
  }
  const isPrivate = visibility === 'private';
  const event = await Event.create({
    owner: req.userId,
    title,
    start,
    end,
    allDay: !!allDay,
    location: location || '',
    memo: memo || '',
    visibility: isPrivate ? 'private' : 'public',
    audienceTiers: isPrivate ? normalizeAudience(audienceTiers) : [],
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
  for (const f of ['title', 'start', 'end', 'allDay', 'location', 'memo']) {
    if (f in req.body) event[f] = req.body[f];
  }
  if ('visibility' in req.body) event.visibility = req.body.visibility === 'private' ? 'private' : 'public';
  if ('audienceTiers' in req.body) event.audienceTiers = normalizeAudience(req.body.audienceTiers);
  if (event.visibility !== 'private') event.audienceTiers = [];
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
