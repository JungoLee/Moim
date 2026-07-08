import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

// Authorization: Bearer <token> 검증 → req.userId 설정.
// 서명 검증만으로는 부족 — 탈퇴한 계정의 JWT 가 만료(30일)까지 살아있으므로
// 사용자가 실제로 존재하는지 확인해 유령 세션을 401 로 끊는다(프론트 401 = 자동 로그아웃).
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, message: '인증이 필요합니다.' });
  try {
    const payload = verifyToken(token);
    const exists = await User.exists({ _id: payload.sub });
    if (!exists) return res.status(401).json({ ok: false, message: '탈퇴했거나 존재하지 않는 계정입니다.' });
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: '토큰이 유효하지 않습니다.' });
  }
}
