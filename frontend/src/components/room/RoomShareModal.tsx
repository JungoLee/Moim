'use client';

import CopyButton from '@/components/CopyButton';
import Modal from '@/components/Modal';
import { BRAND_NAME } from '@/lib/brand';
import type { RoomDetail } from '@/lib/types';
import styles from './RoomShareModal.module.scss';

type Props = {
  room: RoomDetail;
  onClose: () => void;
};

/** 초대 — 링크 복사 · 코드 복사 */
export default function RoomShareModal({ room, onClose }: Props) {
  const link = `${window.location.origin}/rooms/detail?id=${room._id}`;
  return (
    <Modal
      title="친구 초대"
      size="sm"
      onClose={onClose}
      footer={
        <div className="ui-actions">
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      }
    >
      <div className="ui-field">
        <span className="ui-label">초대 링크</span>
        <div className="ui-inline">
          <input className="ui-input" value={link} readOnly aria-label="초대 링크" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton text={link} label="링크 복사" size="md" share shareTitle={`${room.name} · ${BRAND_NAME}`} />
        </div>
        <span className="ui-help">
          {room.joinByUrl
            ? '링크만 있으면 코드 없이 바로 들어와요.'
            : '링크를 받아도 아래 코드가 있어야 들어올 수 있어요. 방장이 설정에서 바꿀 수 있어요.'}
        </span>
      </div>

      <div className="ui-field">
        <span className="ui-label">초대 코드</span>
        <div className={styles.codeRow}>
          <code className={styles.code}>{room.code}</code>
          <CopyButton text={room.code} label="코드 복사" size="md" />
        </div>
        <span className="ui-help">모임 목록의 ‘코드로 입장’에 넣으면 들어와요.</span>
      </div>
    </Modal>
  );
}
