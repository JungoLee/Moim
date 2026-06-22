import User from '../models/User.js';

// requireAuth 다음에 사용 — req.userId 의 사용자가 관리자인지 확인
export async function requireAdmin(req, res, next) {
  const user = await User.findById(req.userId).select('isAdmin');
  if (!user || !user.isAdmin) {
    return res.status(403).json({ ok: false, message: '관리자 권한이 없습니다.' });
  }
  next();
}
