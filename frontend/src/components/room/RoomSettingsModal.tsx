'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import CopyButton from '@/components/CopyButton';
import MemberRow from '@/components/MemberRow';
import Modal from '@/components/Modal';
import { useShell } from '@/components/shell/ShellContext';
import { api } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import { confirmDialog } from '@/lib/confirm';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { RoomDetail } from '@/lib/types';
import styles from './RoomSettingsModal.module.scss';

type Props = {
  room: RoomDetail;
  meId: string;
  /** 바뀐 뒤 방을 다시 불러온다 */
  onChanged: () => Promise<void>;
  onClose: () => void;
};

/** 모임 설정 — 방장: 이름·URL 가입·코드 재발급·멤버 내보내기·삭제. 멤버: 코드와 멤버 보기 */
export default function RoomSettingsModal({ room, meId, onChanged, onClose }: Props) {
  const router = useRouter();
  const { refreshRooms } = useShell();
  const isOwner = room.owner === meId;
  const [name, setName] = useState(room.name);
  const [busy, setBusy] = useState(false);
  const others = room.members.filter((m) => m._id !== room.owner);

  async function run(fn: () => Promise<void>, failText: string) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : failText, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: { name?: string; joinByUrl?: boolean }) {
    await run(async () => {
      await api(`/api/rooms/${room._id}`, { method: 'PATCH', body });
      await onChanged();
      void refreshRooms();
    }, '설정을 바꾸지 못했어요');
  }

  function rename(e: FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v || v === room.name) return;
    void patch({ name: v });
  }

  async function regenCode() {
    const ok = await confirmDialog({
      message: '초대 코드를 새로 발급할까요? 지금 코드는 더 이상 쓸 수 없어요.',
      confirmText: '재발급',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await api(`/api/rooms/${room._id}/code`, { method: 'POST' });
      await onChanged();
      toast('새 초대 코드를 만들었어요', 'success');
    }, '코드를 다시 만들지 못했어요');
  }

  async function kick(userId: string, name: string) {
    const ok = await confirmDialog({
      message: `${name} 님을 내보낼까요?\n이 멤버가 찍은 날짜도 함께 지워져요.`,
      confirmText: '내보내기',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await api(`/api/rooms/${room._id}/members/${userId}`, { method: 'DELETE' });
      await onChanged();
      void refreshRooms();
    }, '내보내지 못했어요');
  }

  async function remove() {
    const ok = await confirmDialog({
      message: '이 모임을 삭제할까요? 대화와 표시한 날짜가 모두 사라지고 되돌릴 수 없어요.',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await api(`/api/rooms/${room._id}`, { method: 'DELETE' });
      await refreshRooms();
      onClose();
      router.push('/rooms');
    }, '모임을 삭제하지 못했어요');
  }

  return (
    <Modal
      title="모임 설정"
      onClose={onClose}
      footer={
        <div className="ui-actions">
          {isOwner && (
            <button type="button" className={`ui-btn ui-btn--danger ${styles.delete}`} onClick={remove} disabled={busy}>
              모임 삭제
            </button>
          )}
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      }
    >
      <div className="ui-field">
        <span className="ui-label">초대 코드</span>
        <div className={styles.codeRow}>
          <code className={styles.code}>{room.code}</code>
          <CopyButton text={room.code} label="코드 복사" />
          <CopyButton
            text={`${window.location.origin}/rooms/detail?id=${room._id}`}
            icon
            title="초대 링크 복사"
            share
            shareTitle={`${room.name} · ${BRAND_NAME}`}
          />
          {isOwner && (
            <button type="button" className="ui-btn ui-btn--sm" onClick={regenCode} disabled={busy}>
              재발급
            </button>
          )}
        </div>
        {isOwner && <span className="ui-help">재발급하면 지금 코드로는 들어올 수 없어요.</span>}
      </div>

      {isOwner ? (
        <>
          <form className="ui-field" onSubmit={rename}>
            <label className="ui-label" htmlFor="room-name">
              모임 이름
            </label>
            <div className="ui-inline">
              <input
                id="room-name"
                className="ui-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="모임 이름"
                maxLength={60}
              />
              <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || !name.trim() || name.trim() === room.name}>
                저장
              </button>
            </div>
          </form>

          <label className="ui-switch">
            <input type="checkbox" checked={!!room.joinByUrl} disabled={busy} onChange={(e) => void patch({ joinByUrl: e.target.checked })} />
            <span className="ui-switch__track" aria-hidden="true" />
            <span>
              링크로 바로 들어오기 허용
              <span className={`ui-help ${styles.block}`}>링크만 있으면 코드 없이 들어와요</span>
            </span>
          </label>

          {others.length > 0 && (
            <div className="ui-field">
              <span className="ui-label">멤버 내보내기</span>
              <div className="ui-list">
                {others.map((m) => (
                  <MemberRow
                    key={m._id}
                    user={m}
                    action={
                      <button type="button" className="ui-btn ui-btn--sm ui-btn--danger" onClick={() => kick(m._id, displayName(m))} disabled={busy}>
                        내보내기
                      </button>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="ui-help">이름 바꾸기·멤버 내보내기·삭제는 방장만 할 수 있어요.</p>
          <div className="ui-field">
            <span className="ui-label">멤버 {room.members.length}명</span>
            <div className="ui-list">
              {room.members.map((m) => (
                <MemberRow key={m._id} user={m} />
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
