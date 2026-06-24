import mongoose from 'mongoose';

// 모임 방 — 코드로 초대된 멤버들이 각자 "가능한 날짜"를 등록하면
// 날짜별 가능 인원을 집계해 모두 되는 날(빈 날)을 찾는다.
const roomSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, index: true }, // 초대 코드
    joinByUrl: { type: Boolean, default: false }, // true 면 멤버가 아니어도 URL 진입 시 자동 가입
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // 멤버별 날짜 표시. status: yes(종일 가능) | no(불가) | after(해당 시간 이후 가능)
    // after 인 경우 time 에 'HH:MM' (예: 퇴근 후 19:00 이후 가능)
    availabilities: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        marks: [
          {
            date: { type: String, required: true },
            status: { type: String, enum: ['yes', 'no', 'after'], default: 'yes' },
            time: { type: String, default: '' },
          },
        ],
      },
    ],
    // 방 댓글
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, default: '' },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Room', roomSchema);
