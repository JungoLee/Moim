// TEMP(email-approval): 로컬 메일 전송기 (워커)
// 운영(Render free)은 외부 SMTP 포트가 차단이라 서버가 직접 메일을 못 보낸다.
// → 운영 서버는 로그인 코드를 DB에만 남기고(평문), 이 스크립트를 로컬 PC에서 돌리면
//   같은 Atlas DB를 폴링해 미발송 코드를 Gmail(SMTP)로 발송한다.
// PC가 꺼져 있으면 코드가 DB에 남아 관리자 페이지의 "코드 대기" 목록이 수동 전달 폴백이 된다.
//
// 실행: backend 폴더에서 `npm run mail-worker`  (backend/.env 의 SMTP_* 필요)
// 제거: Brevo/Starter 승격으로 운영 발송이 열리면 이 파일과 package.json 스크립트 삭제.
import 'dotenv/config';
import mongoose from 'mongoose';
import LoginCode from '../models/LoginCode.js';
import { sendLoginCode, hasMailTransport } from '../utils/mailer.js';

const POLL_MS = 5000;
const MAX_RETRY = 3;
const failures = new Map(); // id → 실패 횟수 (초과 시 건너뜀 → 관리자 수동 전달로 폴백)

async function tick() {
  const pending = await LoginCode.find({ code: { $ne: '' }, expiresAt: { $gt: new Date() } });
  for (const doc of pending) {
    const id = doc._id.toString();
    if ((failures.get(id) || 0) >= MAX_RETRY) continue;
    try {
      await sendLoginCode(doc.email, doc.code);
      // 발송 완료 → 평문 제거(관리자 대기 목록에서도 사라짐). 이미 verify 로 지워졌어도 무해.
      await LoginCode.updateOne({ _id: doc._id }, { code: '' });
      failures.delete(id);
      console.log(`[mail-worker] 발송 완료: ${doc.email}`);
    } catch (err) {
      failures.set(id, (failures.get(id) || 0) + 1);
      console.error(`[mail-worker] 발송 실패(${failures.get(id)}/${MAX_RETRY}) ${doc.email}: ${err.message}`);
    }
  }
}

async function main() {
  if (!hasMailTransport()) {
    console.error('[mail-worker] SMTP 설정이 없습니다 — backend/.env 의 SMTP_* 주석을 해제하세요.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('[mail-worker] MONGODB_URI 가 없습니다 — backend/.env 확인.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[mail-worker] 시작 — ${POLL_MS / 1000}초마다 미발송 로그인 코드를 확인해 메일로 보냅니다. (Ctrl+C 종료)`);
  await tick();
  setInterval(() => tick().catch((e) => console.error('[mail-worker]', e.message)), POLL_MS);
}

main().catch((e) => {
  console.error('[mail-worker] 시작 실패:', e.message);
  process.exit(1);
});
