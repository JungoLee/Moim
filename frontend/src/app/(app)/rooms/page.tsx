'use client';

import { Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import CodeBoxes from '@/components/CodeBoxes';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { useShell } from '@/components/shell/ShellContext';
import { api } from '@/lib/api';
import { roomStatus } from '@/lib/roomStatus';
import styles from './page.module.scss';

const ROOM_CODE_LEN = 8;

export default function RoomsPage() {
  // useSearchParams 는 정적 export 에서 Suspense 안에 있어야 한다
  return (
    <Suspense fallback={null}>
      <Rooms />
    </Suspense>
  );
}

function Rooms() {
  const router = useRouter();
  const params = useSearchParams();
  const { rooms, refreshRooms } = useShell();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  // 최신 목록으로 (틀이 처음 한 번 불러 두지만 방 안에서 바뀐 것을 반영)
  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

  // ?new=1 (사이드바·홈의 '새 모임') → 팝업 바로. ?join=1 → 입장 팝업. 열고 나면 주소에서 지운다
  const wantNew = params.get('new');
  const wantJoin = params.get('join');
  useEffect(() => {
    if (wantNew) setCreateOpen(true);
    if (wantJoin) setJoinOpen(true);
    if (wantNew || wantJoin) router.replace('/rooms');
  }, [wantNew, wantJoin, router]);

  return (
    <div className="ui-page">
      <PageHeader
        title="모임"
        sub="친구를 초대해 각자 되는 날을 찍으면, 다 같이 되는 날을 찾아 드려요."
        actions={
          <>
            <button type="button" className="ui-btn" onClick={() => setJoinOpen(true)} data-guide="rooms-join">
              <Icon name="enter" size={16} />
              초대 코드로 입장
            </button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setCreateOpen(true)} data-guide="rooms-new">
              <Icon name="plus" size={16} />새 모임
            </button>
          </>
        }
      />

      <div data-guide="rooms-list">
        {rooms === null ? (
          <div className={styles.grid} aria-busy="true" aria-label="모임을 불러오는 중">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`ui-skeleton ${styles.skCard}`} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="ui-empty">
            <span className="ui-empty__icon">
              <Icon name="rooms" size={24} />
            </span>
            <strong className="ui-empty__title">아직 모임이 없어요</strong>
            <span className="ui-empty__text">모임을 만들거나 친구에게 받은 초대 코드로 들어와 보세요.</span>
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={16} />새 모임
            </button>
          </div>
        ) : (
          <ul className={styles.grid}>
            {rooms.map((r) => {
              const st = roomStatus(r);
              return (
                <li key={r._id}>
                  <Link href={`/rooms/detail?id=${r._id}`} className={styles.card}>
                    <span className={styles.cardHead}>
                      <strong className={styles.name}>{r.name}</strong>
                      <span className={`ui-chip ui-chip--${st.tone}`}>{st.label}</span>
                    </span>
                    <span className={styles.progress}>
                      <span className="ui-progress" aria-hidden="true">
                        <span style={{ width: `${Math.round(st.progress * 100)}%` }} />
                      </span>
                      <span className={styles.count}>
                        {r.markedCount}/{r.memberCount}
                      </span>
                    </span>
                    <span className={styles.desc}>{st.desc}</span>
                    <span className={styles.meta}>
                      멤버 {r.memberCount}명{r.isOwner ? ' · 내가 방장' : ''}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {createOpen && (
        <CreateRoomModal
          onClose={() => setCreateOpen(false)}
          onDone={async (id) => {
            await refreshRooms();
            router.push(`/rooms/detail?id=${id}`);
          }}
        />
      )}
      {joinOpen && (
        <JoinRoomModal
          onClose={() => setJoinOpen(false)}
          onDone={async (id) => {
            await refreshRooms();
            router.push(`/rooms/detail?id=${id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateRoomModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await api<{ room: { _id: string } }>('/api/rooms', { method: 'POST', body: { name: v } });
      await onDone(res.room._id);
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '만들지 못했어요');
      setBusy(false);
    }
  }

  return (
    <Modal
      title="새 모임"
      size="sm"
      onClose={onClose}
      footer={
        <div className="ui-actions">
          <button type="button" className="ui-btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" form="room-create-form" className="ui-btn ui-btn--primary" disabled={busy || !name.trim()}>
            {busy ? '만드는 중…' : '만들기'}
          </button>
        </div>
      }
    >
      <form id="room-create-form" className="ui-form" onSubmit={submit}>
        <div className="ui-field">
          <label className="ui-label" htmlFor="room-new-name">
            모임 이름
          </label>
          <input
            id="room-new-name"
            className="ui-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 제주 여행"
            maxLength={60}
            autoComplete="off"
          />
          <span className="ui-help">만든 뒤 초대 링크나 코드로 친구를 부를 수 있어요.</span>
        </div>
        {err && (
          <p className="ui-error" role="alert">
            {err}
          </p>
        )}
      </form>
    </Modal>
  );
}

function JoinRoomModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function join(value: string) {
    if (value.length < ROOM_CODE_LEN || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await api<{ roomId: string }>('/api/rooms/join', { method: 'POST', body: { code: value } });
      await onDone(res.roomId);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '들어가지 못했어요');
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void join(code);
  }

  return (
    <Modal
      title="초대 코드로 입장"
      size="sm"
      onClose={onClose}
      footer={
        <div className="ui-actions">
          <button type="button" className="ui-btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" form="room-join-form" className="ui-btn ui-btn--primary" disabled={busy || code.length < ROOM_CODE_LEN}>
            {busy ? '들어가는 중…' : '입장'}
          </button>
        </div>
      }
    >
      <form id="room-join-form" className="ui-form" onSubmit={submit}>
        <p className="ui-help">친구에게 받은 8자리 코드를 넣어 주세요.</p>
        <CodeBoxes
          value={code}
          onChange={(v) => {
            setCode(v);
            setErr('');
          }}
          onComplete={(v) => void join(v)}
          disabled={busy}
          length={ROOM_CODE_LEN}
          uppercase
          label="모임 초대 코드 8자리"
        />
        {err && (
          <p className="ui-error" role="alert">
            {err}
          </p>
        )}
      </form>
    </Modal>
  );
}
