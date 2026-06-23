import mongoose from 'mongoose';

// 시간 요청 — "이때 시간 내주세요"를 친구에게 보내고 수락/거절.
// 수락 시 양쪽 캘린더에 일정이 자동 생성된다.
const timeRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // 요청자
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // 대상
    title: { type: String, default: '시간 요청' },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('TimeRequest', timeRequestSchema);
