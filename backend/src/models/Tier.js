import mongoose from 'mongoose';

// 사용자가 직접 만드는 공개 "그룹".
// 일정 비공개(private) 시, 선택한 그룹의 멤버에게만 상세가 노출된다.
// 멤버는 이메일로 추가하거나, 상대가 고유 코드(code)로 가입할 수 있다.
const tierSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    // 고유 코드 — 코드로 그룹에 가입(join)할 때 사용
    code: { type: String, required: true, unique: true, index: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model('Tier', tierSchema);
