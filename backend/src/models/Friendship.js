import mongoose from 'mongoose';

// 두 사용자 간 친구 관계(쌍당 1개 문서).
// 친구 관계는 "캘린더 열람 권한"만 부여한다. 일정 가시성은 그룹(Tier) + 일정별 공유/비공개로 제어.
const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  },
  { timestamps: true }
);

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.model('Friendship', friendshipSchema);
