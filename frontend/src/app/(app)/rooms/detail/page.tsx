'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import RoomBoardView from '@/components/room/RoomBoardView';
import RoomTableView from '@/components/room/RoomTableView';
import { useRoom } from '@/components/room/useRoom';
import { useTheme } from '@/lib/theme';
import styles from './page.module.scss';

export default function RoomPage() {
  // 정적 export 는 동적 세그먼트를 만들 수 없어 ?id= 로 받는다 (구 /rooms/<id> 는 워커가 301)
  const [roomId, setRoomId] = useState<string | null>(null);
  useEffect(() => {
    setRoomId(new URLSearchParams(window.location.search).get('id') || '');
  }, []);

  if (roomId === null) return <Loading />;
  if (!roomId) return <NotFound text="모임 주소가 올바르지 않아요." />;
  return <RoomScreen roomId={roomId} />;
}

function RoomScreen({ roomId }: { roomId: string }) {
  const r = useRoom(roomId);
  const theme = useTheme();

  if (r.phase === 'denied') {
    return <NotFound text={r.error || '이 모임에는 들어갈 수 없어요.'} />;
  }
  if (r.phase === 'loading' || !r.room) return <Loading />;

  // 테마 분기는 여기 한 곳뿐 — 데이터·동작은 useRoom 이 한 번만 가진다
  return theme === 'table' ? <RoomTableView r={r} /> : <RoomBoardView r={r} />;
}

function Loading() {
  return (
    <div className="ui-page" aria-busy="true" aria-label="모임을 불러오는 중">
      <span className={`ui-skeleton ${styles.skTitle}`} />
      <span className={`ui-skeleton ${styles.skLine}`} />
      <span className={`ui-skeleton ${styles.skBlock}`} />
    </div>
  );
}

function NotFound({ text }: { text: string }) {
  return (
    <div className="ui-page">
      <div className="ui-empty" role="alert">
        <span className="ui-empty__icon">
          <Icon name="lock" size={24} />
        </span>
        <strong className="ui-empty__title">이 모임에 들어갈 수 없어요</strong>
        <span className="ui-empty__text">{text}</span>
        <span className="ui-empty__text">지워졌거나 멤버가 아닐 수 있어요. 방장에게 받은 초대 코드로 들어갈 수 있어요.</span>
        <Link href="/rooms" className="ui-btn ui-btn--primary">
          모임 목록으로
        </Link>
      </div>
    </div>
  );
}
