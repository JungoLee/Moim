import mongoose from 'mongoose';

// 두 사용자 간 친구 관계(쌍당 1개 문서).
// 노출 등급은 "방향성"을 가진다: 각자가 상대에게 자기 일정을 얼마나 보여줄지 따로 설정.
//   - close  : 상세 일정 노출 (친한친구) + (추후) 시간 요청 가능
//   - normal : 바쁜 시간 블록만 노출
const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    // recipient 가 requester 의 일정을 보는 등급 (= requester 가 recipient 에게 부여한 공개 등급)
    requesterTierForRecipient: { type: String, enum: ['close', 'normal'], default: 'normal' },
    // requester 가 recipient 의 일정을 보는 등급 (= recipient 가 requester 에게 부여한 공개 등급)
    recipientTierForRequester: { type: String, enum: ['close', 'normal'], default: 'normal' },
  },
  { timestamps: true }
);

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.model('Friendship', friendshipSchema);
