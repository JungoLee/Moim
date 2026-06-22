import { Router } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Friendship from '../models/Friendship.js';
import Tier from '../models/Tier.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 일정을 상세(detail)로 변환
function toDetail(e) {
  return {
    _id: e._id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    location: e.location,
    memo: e.memo,
    visibility: e.visibility,
    busy: false,
  };
}

// 일정을 "바쁨" 블록으로 변환
function toBusy(e) {
  return { _id: e._id, start: e.start, end: e.end, allDay: e.allDay, busy: true };
}

// 특정 사용자의 캘린더 조회 — 공유(public)는 상세, 비공개(private)는 등급 멤버에게만 상세
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

  // 본인 → 전체 상세
  if (userId === me) {
    const events = await Event.find(q).sort({ start: 1 });
    return res.json({ ok: true, owner, relation: 'self', events });
  }

  // 캘린더 열람 권한 = 친구 관계
  const fs = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: me, recipient: userId },
      { requester: userId, recipient: me },
    ],
  });
  if (!fs) return res.status(403).json({ ok: false, message: '이 사용자의 캘린더를 볼 권한이 없습니다.' });

  // owner 의 등급 중 내가 멤버인 것들 → 비공개 일정 상세 열람 가능
  const myTiers = await Tier.find({ owner: userId, members: me }).select('_id');
  const myTierIds = new Set(myTiers.map((t) => t._id.toString()));

  const events = await Event.find(q).sort({ start: 1 });
  const mapped = events.map((e) => {
    if (e.visibility === 'private') {
      const allowed = (e.audienceTiers || []).some((tid) => myTierIds.has(tid.toString()));
      return allowed ? toDetail(e) : toBusy(e);
    }
    // public / default → 상세
    return toDetail(e);
  });

  res.json({ ok: true, owner, relation: 'friend', events: mapped });
});

export default router;
