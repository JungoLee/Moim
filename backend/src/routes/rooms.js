import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const STATUSES = new Set(['yes', 'no', 'after']);

// 멤버 marks 정규화: [{date, status, time?}] (날짜당 1개)
function cleanMarks(marks) {
  if (!Array.isArray(marks)) return [];
  const seen = new Set();
  const out = [];
  for (const m of marks) {
    if (!m || typeof m.date !== 'string' || !DATE_RE.test(m.date)) continue;
    if (!STATUSES.has(m.status)) continue;
    if (seen.has(m.date)) continue;
    seen.add(m.date);
    const mk = { date: m.date, status: m.status, time: '' };
    if (m.status === 'after') mk.time = typeof m.time === 'string' && TIME_RE.test(m.time) ? m.time : '18:00';
    out.push(mk);
  }
  return out;
}

async function genCode() {
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase();
    if (code.length === 8 && !(await Room.exists({ code }))) return code;
  }
  return crypto.randomBytes(8).toString('hex').slice(0, 8).toUpperCase();
}

function isMember(room, me) {
  return room.owner.toString() === me || room.members.some((m) => m.toString() === me);
}

// 내 방 목록 (소유 + 참여)
router.get('/', async (req, res) => {
  const me = req.userId;
  const rooms = await Room.find({ $or: [{ owner: me }, { members: me }] })
    .select('name code members owner')
    .sort({ createdAt: -1 });
  res.json({
    ok: true,
    rooms: rooms.map((r) => ({
      _id: r._id,
      name: r.name,
      code: r.code,
      memberCount: r.members.length,
      isOwner: r.owner.toString() === me,
    })),
  });
});

// 방 생성
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, message: 'name 이 필요합니다.' });
  const code = await genCode();
  const room = await Room.create({ owner: req.userId, name: name.trim(), code, members: [req.userId], availabilities: [] });
  res.status(201).json({ ok: true, room: { _id: room._id, name: room.name, code: room.code } });
});

// 코드로 입장
router.post('/join', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ ok: false, message: 'code 가 필요합니다.' });
  const room = await Room.findOne({ code: code.trim().toUpperCase() });
  if (!room) return res.status(404).json({ ok: false, message: '해당 코드의 방이 없습니다.' });
  if (!room.members.some((m) => m.toString() === req.userId)) {
    room.members.push(req.userId);
    await room.save();
  }
  res.json({ ok: true, roomId: room._id, name: room.name });
});

// 방 상세 (멤버 + 가용성)
router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const room = await Room.findById(req.params.id).populate('members', 'name email picture');
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없습니다.' });
  if (!isMember(room, req.userId)) return res.status(403).json({ ok: false, message: '이 방의 멤버가 아닙니다.' });

  const availabilities = {};
  for (const a of room.availabilities) {
    availabilities[a.user.toString()] = (a.marks || []).map((m) => ({ date: m.date, status: m.status, time: m.time || '' }));
  }

  res.json({
    ok: true,
    room: {
      _id: room._id,
      name: room.name,
      code: room.code,
      owner: room.owner,
      members: room.members.map((m) => ({ _id: m._id, name: m.name, email: m.email, picture: m.picture })),
    },
    availabilities,
    isOwner: room.owner.toString() === req.userId,
  });
});

// 내 가능 날짜 저장 (전체 교체)
router.put('/:id/availability', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const clean = cleanMarks(req.body.marks);
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없습니다.' });
  if (!isMember(room, req.userId)) return res.status(403).json({ ok: false, message: '이 방의 멤버가 아닙니다.' });

  const entry = room.availabilities.find((a) => a.user.toString() === req.userId);
  if (entry) entry.marks = clean;
  else room.availabilities.push({ user: req.userId, marks: clean });
  await room.save();
  res.json({ ok: true });
});

// 방 삭제 (owner 만)
router.delete('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const r = await Room.deleteOne({ _id: req.params.id, owner: req.userId });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: '방을 찾을 수 없거나 권한이 없습니다.' });
  res.json({ ok: true });
});

export default router;
