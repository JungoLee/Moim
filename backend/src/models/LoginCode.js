import mongoose from 'mongoose';

// 이메일 로그인 인증 코드 — 이메일당 활성 코드 1개(재요청 시 교체).
// 코드는 해시로만 저장하고, expiresAt TTL 인덱스로 만료분은 Mongo가 자동 삭제.
const loginCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 }, // 검증 실패 횟수 (5회 초과 시 코드 폐기)
  sentAt: { type: Date, default: Date.now }, // 재전송 쿨다운(60초) 기준
});

loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('LoginCode', loginCodeSchema);
