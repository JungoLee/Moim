import { verifyToken } from '../utils/jwt.js';

// Authorization: Bearer <token> 검증 → req.userId 설정
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, message: '인증이 필요합니다.' });
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: '토큰이 유효하지 않습니다.' });
  }
}
