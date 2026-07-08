import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    location: { type: String, default: '' },
    memo: { type: String, default: '' },
    // public  : 캘린더를 보는 모두에게 상세 노출 (공유)
    // private : audienceTiers 그룹의 멤버에게만 상세, 그 외엔 "바쁨" (비공개)
    // default : (구버전 호환) public 과 동일 취급
    visibility: { type: String, enum: ['public', 'private', 'default'], default: 'public' },
    // 비공개(private) 시 상세를 볼 수 있는 그룹 목록
    audienceTiers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tier' }],
    // 출처 기록 — 시간 요청 수락으로 자동 생성된 일정이면 누가·언제 요청했는지 (수락 시점 스냅샷)
    origin: {
      kind: { type: String, default: '' }, // 'timeRequest'
      fromName: { type: String, default: '' }, // 요청 보낸 사람 표시명
      toName: { type: String, default: '' }, // 요청 받은 사람 표시명
      requestedAt: { type: Date },
    },
  },
  { timestamps: true }
);

eventSchema.index({ owner: 1, start: 1 });

export default mongoose.model('Event', eventSchema);
