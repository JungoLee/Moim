import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Tier from '../models/Tier.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 충돌 없는 짧은 코드 생성 (대문자+숫자 8자리)
async function generateUniqueCode() {
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase();
    if (code.length === 8 && !(await Tier.exists({ code }))) return code;
  }
  // 극히 드문 실패 시 타임스탬프 기반 폴백
  return crypto.randomBytes(8).toString('hex').slice(0, 8).toUpperCase();
}

// 내 그룹 목록 (멤버 정보 포함)
router.get('/', async (req, res) => {
  const tiers = await Tier.find({ owner: req.userId })
    .populate('members', 'name email picture')
    .sort({ createdAt: 1 });
  res.json({ ok: true, tiers });
});

// 그룹 생성
router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, message: 'name 이 필요합니다.' });
  // 색상은 #rrggbb / #rgb 형식만 허용, 아니면 기본값
  const safeColor = typeof color === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : '#7c8cff';
  const code = await generateUniqueCode();
  const tier = await Tier.create({ owner: req.userId, name: name.trim(), code, color: safeColor, members: [] });
  res.status(201).json({ ok: true, tier });
});

// 그룹 삭제
router.delete('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const r = await Tier.deleteOne({ _id: req.params.id, owner: req.userId });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: '그룹을 찾을 수 없습니다.' });
  res.json({ ok: true });
});

// 멤버 추가 (이메일로)
router.post('/:id/members', async (req, res) => {
  const { email } = req.body;
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  if (!email) return res.status(400).json({ ok: false, message: 'email 이 필요합니다.' });
  const tier = await Tier.findOne({ _id: req.params.id, owner: req.userId });
  if (!tier) return res.status(404).json({ ok: false, message: '그룹을 찾을 수 없습니다.' });
  const target = await User.findOne({ email });
  if (!target) return res.status(404).json({ ok: false, message: '해당 이메일의 사용자가 없습니다.' });
  if (tier.members.some((m) => m.toString() === target._id.toString())) {
    return res.status(409).json({ ok: false, message: '이미 그룹에 포함된 사용자입니다.' });
  }
  tier.members.push(target._id);
  await tier.save();
  res.json({ ok: true });
});

// 멤버 제거
router.delete('/:id/members/:userId', async (req, res) => {
  const { id, userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const tier = await Tier.findOne({ _id: id, owner: req.userId });
  if (!tier) return res.status(404).json({ ok: false, message: '그룹을 찾을 수 없습니다.' });
  tier.members = tier.members.filter((m) => m.toString() !== userId);
  await tier.save();
  res.json({ ok: true });
});

// 코드로 그룹 가입 (내가 멤버로 들어감)
router.post('/join', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ ok: false, message: 'code 가 필요합니다.' });
  const tier = await Tier.findOne({ code: code.trim().toUpperCase() });
  if (!tier) return res.status(404).json({ ok: false, message: '해당 코드의 그룹이 없습니다.' });
  if (tier.owner.toString() === req.userId) {
    return res.status(400).json({ ok: false, message: '본인 그룹에는 가입할 수 없습니다.' });
  }
  if (tier.members.some((m) => m.toString() === req.userId)) {
    return res.status(409).json({ ok: false, message: '이미 가입한 그룹입니다.' });
  }
  tier.members.push(req.userId);
  await tier.save();
  res.json({ ok: true, tierName: tier.name });
});

export default router;
