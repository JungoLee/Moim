import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import User from '../models/User.js';
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
  // members 가 populate 되면(GET /:id) m 은 User 문서 → m._id 사용, 아니면 ObjectId 자체.
  // (populate 시 m.toString() 은 '[object Object]' 라 _id 비교가 깨지는 버그 수정)
  return room.owner.toString() === me || room.members.some((m) => (m._id || m).toString() === me);
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
  const room = await Room.findById(req.params.id).populate('members', 'name nickname email picture');
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없습니다.' });
  if (!isMember(room, req.userId)) return res.status(403).json({ ok: false, message: '이 방의 멤버가 아닙니다.' });

  const availabilities = {};
  for (const a of room.availabilities) {
    availabilities[a.user.toString()] = (a.marks || []).map((m) => ({ date: m.date, status: m.status, time: m.time || '' }));
  }

  // 댓글 작성자 프로필 사진 매핑 (멤버 목록에서 조회)
  const picById = {};
  for (const m of room.members) picById[m._id.toString()] = m.picture || '';

  res.json({
    ok: true,
    room: {
      _id: room._id,
      name: room.name,
      code: room.code,
      joinByUrl: room.joinByUrl,
      owner: room.owner,
      members: room.members.map((m) => ({ _id: m._id, name: m.name, nickname: m.nickname, email: m.email, picture: m.picture })),
    },
    availabilities,
    comments: (room.comments || []).map((c) => ({
      _id: c._id,
      user: c.user,
      name: c.name,
      picture: picById[c.user.toString()] || '',
      text: c.text,
      createdAt: c.createdAt,
    })),
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

// 댓글 작성
router.post('/:id/comments', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, message: '내용을 입력하세요.' });
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없습니다.' });
  if (!isMember(room, req.userId)) return res.status(403).json({ ok: false, message: '이 방의 멤버가 아닙니다.' });
  const me = await User.findById(req.userId).select('name nickname');
  const author = me?.nickname || me?.name || '';
  room.comments.push({ user: req.userId, name: author, text: text.slice(0, 1000), createdAt: new Date() });
  await room.save();
  res.status(201).json({ ok: true });
});

// 댓글 삭제 (작성자 또는 방장)
router.delete('/:id/comments/:commentId', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.commentId)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없습니다.' });
  const c = room.comments.id(req.params.commentId);
  if (!c) return res.status(404).json({ ok: false, message: '댓글을 찾을 수 없습니다.' });
  const isOwner = room.owner.toString() === req.userId;
  if (c.user.toString() !== req.userId && !isOwner) {
    return res.status(403).json({ ok: false, message: '삭제 권한이 없습니다.' });
  }
  c.deleteOne();
  await room.save();
  res.json({ ok: true });
});

// 방 설정 변경 (방장만): 이름 / URL 가입 허용
router.patch('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const update = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ ok: false, message: '이름이 비어 있습니다.' });
    update.name = name;
  }
  if (req.body.joinByUrl !== undefined) update.joinByUrl = !!req.body.joinByUrl;
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ ok: false, message: '변경할 내용이 없습니다.' });
  }
  const room = await Room.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, update, { new: true });
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없거나 권한이 없습니다.' });
  res.json({ ok: true });
});

// 초대 코드 재발급 (방장만) — 기존 코드/링크 무효화
router.post('/:id/code', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const room = await Room.findOne({ _id: req.params.id, owner: req.userId });
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없거나 권한이 없습니다.' });
  room.code = await genCode();
  await room.save();
  res.json({ ok: true, code: room.code });
});

// 멤버 강퇴 (방장만, 방장 본인은 불가)
router.delete('/:id/members/:userId', async (req, res) => {
  const { id, userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const room = await Room.findOne({ _id: id, owner: req.userId });
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없거나 권한이 없습니다.' });
  if (userId === room.owner.toString()) {
    return res.status(400).json({ ok: false, message: '방장은 강퇴할 수 없습니다.' });
  }
  room.members = room.members.filter((m) => m.toString() !== userId);
  room.availabilities = room.availabilities.filter((a) => a.user.toString() !== userId);
  await room.save();
  res.json({ ok: true });
});

// URL 가입 — 코드 없이 입장. 방장이 허용(joinByUrl)했을 때만 자동 가입, 아니면 코드 필요.
router.post('/:id/join-url', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: '방을 찾을 수 없습니다.' });
  if (isMember(room, req.userId)) return res.json({ ok: true, roomId: room._id, name: room.name });
  if (!room.joinByUrl) {
    return res.status(403).json({ ok: false, needCode: true, message: '초대 코드로 입장하세요.' });
  }
  room.members.push(req.userId);
  await room.save();
  res.json({ ok: true, roomId: room._id, name: room.name });
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
