import mongoose from 'mongoose';

// 모임 방 — 코드로 초대된 멤버들이 각자 "가능한 날짜"를 등록하면
// 날짜별 가능 인원을 집계해 모두 되는 날(빈 날)을 찾는다.
const roomSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, index: true }, // 초대 코드
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // 멤버별 가능 날짜 ('YYYY-MM-DD' 문자열 배열)
    availabilities: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        dates: [{ type: String }],
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Room', roomSchema);
