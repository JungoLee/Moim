'use client';

import { useState } from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import { fmtKeyRange, fmtRelative } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import CandidateList, { CandidateStrip } from './CandidateList';
import HeatCalendar from './HeatCalendar';
import MemberStrip from './MemberStrip';
import ModeBar from './ModeBar';
import MonthNav from './MonthNav';
import RoomChat from './RoomChat';
import RoomMobileHead, { HeadIconButton } from './RoomMobileHead';
import RoomSettingsModal from './RoomSettingsModal';
import RoomShareModal from './RoomShareModal';
import SheetPanel from './SheetPanel';
import type { RoomApi } from './useRoom';
import styles from './RoomBoardView.module.scss';

type Tab = 'cands' | 'chat';

/** 보드 테마의 모임 방 — 겹침 달력 + 오른쪽 후보·대화 패널 (docs/design-system.md 6-3) */
export default function RoomBoardView({ r }: { r: RoomApi }) {
  const room = r.room;
  const [tab, setTab] = useState<Tab>('cands');
  const [sheet, setSheet] = useState(false); // 모바일 전체 화면 시트
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  if (!room) return null;

  const confirmedRange = room.confirmed ? fmtKeyRange(room.confirmed.start, room.confirmed.end) : '';
  const all = r.total > 0 && r.markedCount === r.total;
  const progress = all ? `${r.total}명 모두 찍음` : `${r.total}명 중 ${r.markedCount}명 찍음`;
  const last = r.comments.length ? r.comments[r.comments.length - 1] : null;
  const lastAuthor = last ? r.members.find((m) => m._id === last.user) : undefined;

  const openSheet = (t: Tab) => {
    setTab(t);
    setSheet(true);
  };

  return (
    <div className={`ui-page ${styles.page}`} data-has-strip>
      <RoomMobileHead name={room.name} sub={room.confirmed ? `확정 ${confirmedRange}` : progress}>
        <HeadIconButton icon="share" label="초대" onClick={() => setShareOpen(true)} />
        <HeadIconButton icon="settings" label="모임 설정" onClick={() => setSettingsOpen(true)} />
        <HeadIconButton icon="chat" label={r.unread > 0 ? `대화 열기, 안 읽은 메시지 ${r.unread}개` : '대화 열기'} onClick={() => openSheet('chat')} badge={r.unread} />
      </RoomMobileHead>

      <div className={styles.deskHead}>
        <PageHeader
          eyebrow="모임"
          title={room.name}
          badge={room.confirmed ? <span className="ui-chip ui-chip--accent">확정 {confirmedRange}</span> : undefined}
          sub={`멤버 ${r.total}명 · 방장 ${r.ownerName}`}
          actions={
            <>
              <button type="button" className="ui-btn" onClick={() => setShareOpen(true)} data-guide="room-invite">
                <Icon name="share" size={16} />
                초대
              </button>
              <button type="button" className="ui-btn ui-btn--icon" onClick={() => setSettingsOpen(true)} aria-label="모임 설정" title="모임 설정">
                <Icon name="settings" size={18} />
              </button>
            </>
          }
        />
      </div>

      <div className={styles.members}>
        <MemberStrip members={r.ordered} meId={r.meId} markedIds={r.markedIds} />
      </div>

      <div className="ui-grid-2">
        <section className={styles.calCard} aria-label="겹침 달력">
          <div className={styles.calHead}>
            <MonthNav month={r.month} onShift={r.shiftMonth} onToday={r.goToday} />
            <ModeBar
              className={styles.modes}
              mode={r.mode}
              onMode={r.setMode}
              afterTime={r.afterTime}
              onAfterTime={r.setAfterTime}
              onReset={r.resetMine}
              canReset={Object.keys(r.myMarks).length > 0}
              onRefresh={() => void r.reload()}
            />
          </div>

          <HeatCalendar
            month={r.month}
            myMarks={r.myMarks}
            summary={r.summary}
            total={r.total}
            holidays={r.holidays}
            confirmed={room.confirmed}
            onApply={r.applyMarks}
          />

          <div className={styles.foot}>
            <span className={styles.hintDesk}>날짜를 누르거나 끌어서 표시해요</span>
            <span className={styles.hintTouch}>누르거나, 길게 눌러 끌면 여러 날을 한 번에 표시해요</span>
            <span className={styles.scale} aria-label={`겹침 정도: 0명부터 ${r.total}명 모두까지`}>
              0명
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <i key={n} data-level={n} aria-hidden="true" />
              ))}
              {r.total}명 모두
            </span>
          </div>
        </section>

        <SheetPanel open={sheet} onClose={() => setSheet(false)} label={tab === 'chat' ? '대화' : '후보 날짜'} className={styles.side}>
          <div className={`ui-tabs ${styles.tabs}`} role="tablist" aria-label="후보와 대화">
            <button type="button" role="tab" id="room-tab-cands" aria-selected={tab === 'cands'} aria-controls="room-panel" onClick={() => setTab('cands')}>
              후보 날짜
              <span className="ui-chip ui-chip--muted">{r.cands.length + r.near.length}</span>
            </button>
            <button type="button" role="tab" id="room-tab-chat" aria-selected={tab === 'chat'} aria-controls="room-panel" onClick={() => setTab('chat')} data-guide="room-chat">
              대화
              {r.unread > 0 && (
                <span className="ui-badge" aria-label={`안 읽은 메시지 ${r.unread}개`}>
                  {r.unread > 99 ? '99+' : r.unread}
                </span>
              )}
            </button>
          </div>

          <div className={styles.tabBody} id="room-panel" role="tabpanel" aria-labelledby={tab === 'chat' ? 'room-tab-chat' : 'room-tab-cands'}>
            {tab === 'cands' ? (
              <div className={styles.cands}>
                <CandidateList
                  cands={r.cands}
                  confirmed={room.confirmed}
                  isOwner={r.isOwner}
                  total={r.total}
                  members={r.members}
                  near={r.near}
                  markedIds={r.markedIds}
                  meId={r.meId}
                  onConfirm={(c, changing) => void r.confirm({ start: c.start, end: c.end }, changing, c)}
                  onUnconfirm={() => void r.unconfirm()}
                />
              </div>
            ) : (
              <RoomChat
                roomId={r.roomId}
                meId={r.meId}
                members={r.members}
                comments={r.comments}
                onRefresh={r.refreshComments}
                onSeen={r.markChatSeen}
              />
            )}
          </div>

          {tab !== 'chat' && last && (
            <button type="button" className={styles.preview} onClick={() => setTab('chat')}>
              <Avatar src={last.picture || lastAuthor?.picture} name={lastAuthor ? displayName(lastAuthor) : last.name} id={last.user} size="sm" />
              <span className={styles.previewText}>
                <strong>{lastAuthor ? displayName(lastAuthor) : last.name}</strong> · {last.text}
              </span>
              <span className={styles.previewTime}>{fmtRelative(last.createdAt)}</span>
            </button>
          )}
        </SheetPanel>
      </div>

      <CandidateStrip
        cands={r.cands}
        confirmed={room.confirmed}
        isOwner={r.isOwner}
        total={r.total}
        members={r.members}
        near={r.near}
        markedIds={r.markedIds}
        meId={r.meId}
        onConfirm={(c, changing) => void r.confirm({ start: c.start, end: c.end }, changing, c)}
        onMore={() => openSheet('cands')}
        onInvite={() => setShareOpen(true)}
      />

      {shareOpen && <RoomShareModal room={room} onClose={() => setShareOpen(false)} />}
      {settingsOpen && <RoomSettingsModal room={room} meId={r.meId} onChanged={() => r.reload()} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
