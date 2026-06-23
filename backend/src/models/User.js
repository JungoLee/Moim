import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    name: { type: String, default: '' }, // 구글 이름
    nickname: { type: String, default: '' }, // 사용자가 설정한 표시명(있으면 우선)
    picture: { type: String, default: '' },
    isAdmin: { type: Boolean, default: false },
    // 연차 계산기 설정 (사용자별 유지). start/renewal 은 'YYYY-MM-DD' 문자열.
    // 갱신일이 지나면 서버가 자동으로 다음 해로 이월한다(routes/auth.js).
    leave: {
      remaining: { type: Number, default: 15 },
      start: { type: String, default: '' },
      renewal: { type: String, default: '' },
      maxConsec: { type: Number, default: 5 },
      style: { type: String, default: 'balanced' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
