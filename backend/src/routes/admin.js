import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// 가입자 목록
router.get('/users', async (req, res) => {
  const users = await User.find().select('name email picture isAdmin createdAt').sort({ createdAt: 1 });
  res.json({ ok: true, users });
});

// 관리자 권한 부여/회수
router.patch('/users/:id/admin', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const isAdmin = !!req.body.isAdmin;
  // 본인 권한 회수로 인한 잠금 방지
  if (req.params.id === req.userId && !isAdmin) {
    return res.status(400).json({ ok: false, message: '본인의 관리자 권한은 회수할 수 없습니다.' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isAdmin }, { new: true }).select('name email isAdmin');
  if (!user) return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
  res.json({ ok: true, user });
});

export default router;
