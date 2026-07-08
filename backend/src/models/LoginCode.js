import mongoose from 'mongoose';

// 이메일 로그인 인증 코드 — 이메일당 활성 코드 1개(재요청 시 교체).
// 코드는 해시로만 저장하고, expiresAt TTL 인덱스로 만료분은 Mongo가 자동 삭제.
const loginCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  codeHash: { type: String, required: true },
  // TEMP(email-approval): 발송 수단(Brevo/SMTP)이 없을 때만 평문 보관 — 관리자가 확인해
  // 본인에게 직접 전달(승인)하는 임시 운영용. 발송 수단 설정 후엔 항상 '' → 그때 제거 가능.
  code: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 }, // 검증 실패 횟수 (5회 초과 시 코드 폐기)
  sentAt: { type: Date, default: Date.now }, // 재전송 쿨다운(60초) 기준
});

loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('LoginCode', loginCodeSchema);
