import { Router } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 특정 사용자의 캘린더 조회 — 노출 등급(self/close/normal)을 반영
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { from, to } = req.query;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ ok: false, message: '잘못된 id 입니다.' });
  }
  const me = req.userId;

  const owner = await User.findById(userId).select('name email picture');
  if (!owner) return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });

  const q = { owner: userId };
  if (from || to) {
    q.start = {};
    if (from) q.start.$gte = new Date(from);
    if (to) q.start.$lte = new Date(to);
  }

  // 본인 → 전체 노출
  if (userId === me) {
    const events = await Event.find(q).sort({ start: 1 });
    return res.json({ ok: true, owner, tier: 'self', events });
  }

  // 친구 관계 확인 + 내가 이 소유자의 일정을 보는 등급 판정
  const fs = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: me, recipient: userId },
      { requester: userId, recipient: me },
    ],
  });
  if (!fs) return res.status(403).json({ ok: false, message: '이 사용자의 캘린더를 볼 권한이 없습니다.' });

  // owner 가 나에게 부여한 등급
  const ownerIsRequester = fs.requester.toString() === userId;
  const tier = ownerIsRequester ? fs.requesterTierForRecipient : fs.recipientTierForRequester;

  const events = await Event.find(q).sort({ start: 1 });

  if (tier === 'close') {
    // 상세 노출 (단, private 일정은 "바쁨"으로만)
    const mapped = events.map((e) =>
      e.visibility === 'private'
        ? { _id: e._id, start: e.start, end: e.end, allDay: e.allDay, busy: true }
        : {
            _id: e._id,
            title: e.title,
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            location: e.location,
            memo: e.memo,
            busy: false,
          }
    );
    return res.json({ ok: true, owner, tier: 'close', events: mapped });
  }

  // normal → "바쁨" 블록만
  const busy = events.map((e) => ({ _id: e._id, start: e.start, end: e.end, allDay: e.allDay, busy: true }));
  res.json({ ok: true, owner, tier: 'normal', events: busy });
});

export default router;
