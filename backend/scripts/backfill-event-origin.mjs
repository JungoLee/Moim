// 일회성 백필: 과거에 수락된 TimeRequest 의 출처(origin)를 그때 생성된 Event 에 소급 기록.
// 매칭 기준: owner(요청 당사자) + title + start + end 가 일치하고 origin 이 아직 없는 일정.
// 실행: backend 폴더에서 `node scripts/backfill-event-origin.mjs` — 완료 후 이 파일은 삭제해도 됨.
import 'dotenv/config';
import mongoose from 'mongoose';
import TimeRequest from '../src/models/TimeRequest.js';
import Event from '../src/models/Event.js';
import User from '../src/models/User.js';

await mongoose.connect(process.env.MONGODB_URI);

const accepted = await TimeRequest.find({ status: 'accepted' });
console.log(`수락된 시간 요청 ${accepted.length}건 검사`);

let updated = 0;
for (const tr of accepted) {
  const [fromUser, toUser] = await Promise.all([User.findById(tr.from), User.findById(tr.to)]);
  const label = (u) => (u && (u.nickname || u.name || u.email)) || '알 수 없음';
  const origin = { kind: 'timeRequest', fromName: label(fromUser), toName: label(toUser), requestedAt: tr.createdAt };
  const r = await Event.updateMany(
    {
      owner: { $in: [tr.from, tr.to] },
      title: tr.title,
      start: tr.start,
      end: tr.end,
      $or: [{ 'origin.kind': { $exists: false } }, { 'origin.kind': '' }],
    },
    { $set: { origin } }
  );
  if (r.modifiedCount > 0) {
    updated += r.modifiedCount;
    console.log(`  ✓ "${tr.title}" (${tr.start.toISOString().slice(0, 10)}) → 일정 ${r.modifiedCount}건에 출처 기록`);
  }
}

// 시간 요청 출신 일정은 둘 사이의 약속 → 공개(public)로 생성됐던 것을 비공개로 전환
const vis = await Event.updateMany(
  { 'origin.kind': 'timeRequest', visibility: 'public' },
  { $set: { visibility: 'private' } }
);
console.log(`완료 — 출처 ${updated}건 백필, 비공개 전환 ${vis.modifiedCount}건`);
await mongoose.disconnect();
