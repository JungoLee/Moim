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
  const origin = { kind: 'timeRequest', requestId: tr._id, fromName: label(fromUser), toName: label(toUser), requestedAt: tr.createdAt };
  const r = await Event.updateMany(
    {
      owner: { $in: [tr.from, tr.to] },
      title: tr.title,
      start: tr.start,
      end: tr.end,
      // 출처가 없거나, 이전 버전 백필이라 requestId(쌍 연결 키)가 빠진 것 모두 갱신
      $or: [{ 'origin.kind': { $exists: false } }, { 'origin.kind': '' }, { 'origin.requestId': { $exists: false } }],
    },
    { $set: { origin } }
  );
  if (r.modifiedCount > 0) {
    updated += r.modifiedCount;
    console.log(`  ✓ "${tr.title}" (${tr.start.toISOString().slice(0, 10)}) → 일정 ${r.modifiedCount}건에 출처 기록`);
  }
  // 사용자가 제목/시간을 수정한 사본은 위 매칭에서 빠짐 — 수정해도 변하지 않는
  // origin.requestedAt(=요청 생성 시각)으로 requestId 만 이어붙인다 (상대 삭제 오탐 방지)
  const r2 = await Event.updateMany(
    {
      owner: { $in: [tr.from, tr.to] },
      'origin.kind': 'timeRequest',
      'origin.requestedAt': tr.createdAt,
      'origin.requestId': { $exists: false },
    },
    { $set: { 'origin.requestId': tr._id } }
  );
  if (r2.modifiedCount > 0) {
    updated += r2.modifiedCount;
    console.log(`  ✓ "${tr.title}" 수정된 사본 ${r2.modifiedCount}건에 requestId 연결`);
  }
}

// 시간 요청 출신 일정은 둘 사이의 약속 → 공개(public)로 생성됐던 것을 비공개로 전환
const vis = await Event.updateMany(
  { 'origin.kind': 'timeRequest', visibility: 'public' },
  { $set: { visibility: 'private' } }
);
console.log(`완료 — 출처 ${updated}건 백필, 비공개 전환 ${vis.modifiedCount}건`);
await mongoose.disconnect();
