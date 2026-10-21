'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import { fmtKeyRange } from '@/lib/datetime';
import CandidateList, { CandidateStrip } from './CandidateList';
import MatrixList, { MatrixFilters } from './MatrixList';
import type { MatrixFilter } from './MatrixList';
import MemberMatrix from './MemberMatrix';
import MemberStrip from './MemberStrip';
import ModeBar from './ModeBar';
import MonthNav from './MonthNav';
import RoomChat from './RoomChat';
import RoomMobileHead, { HeadIconButton } from './RoomMobileHead';
import RoomSettingsModal from './RoomSettingsModal';
import RoomShareModal from './RoomShareModal';
import SheetPanel from './SheetPanel';
import type { RoomApi } from './useRoom';
import styles from './RoomTableView.module.scss';

type Sheet = null | 'cands' | 'chat';

/** 표 테마의 모임 방 — 사람×날짜 표, 아래에 후보·대화 (docs/design-system.md 6-3) */
export default function RoomTableView({ r }: { r: RoomApi }) {
  const room = r.room;
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<MatrixFilter>(r.total >= 4 ? 'three' : 'all');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  if (!room) return null;

  const confirmedRange = room.confirmed ? fmtKeyRange(room.confirmed.start, room.confirmed.end) : '';
  const all = r.total > 0 && r.markedCount === r.total;
  const progress = all ? `${r.total}명 모두 찍음` : `${r.total}명 중 ${r.markedCount}명 찍음`;
  const toggleEditing = () => {
    setEditing((v) => {
      if (!v) setFilter('all'); // 고칠 때는 모든 날짜가 보여야 한다
      return !v;
    });
  };
  const editLabel = editing ? '고치기 끝' : '내 줄 고치기';
  const onConfirm = (c: { start: string; end: string }, changing: boolean) => void r.confirm({ start: c.start, end: c.end }, changing);

  return (
    <div className={`ui-page ${styles.page}`} data-has-strip>
      {/* 모바일 남색 머리 */}
      <div className={styles.mobileTop}>
        <RoomMobileHead name={room.name} sub={room.confirmed ? `확정 ${confirmedRange}` : `${r.month.getMonth() + 1}월 · ${progress}`}>
          <button type="button" className={styles.editBtn} aria-pressed={editing} onClick={toggleEditing}>
            {editLabel}
          </button>
        </RoomMobileHead>
        <div className={styles.mobileRow}>
          <MatrixFilters value={filter} onChange={setFilter} total={r.total} />
          <span className={styles.mobileIcons}>
            <HeadIconButton icon="share" label="초대" onClick={() => setShareOpen(true)} />
            <HeadIconButton icon="settings" label="모임 설정" onClick={() => setSettingsOpen(true)} />
            <HeadIconButton icon="chat" label={r.unread > 0 ? `대화 열기, 안 읽은 메시지 ${r.unread}개` : '대화 열기'} onClick={() => setSheet('chat')} badge={r.unread} />
          </span>
        </div>
      </div>

      {/* 데스크톱 머리 */}
      <div className={styles.deskHead}>
        <PageHeader
          eyebrow="모임"
          title={room.name}
          badge={room.confirmed ? <span className="ui-chip ui-chip--accent">확정 {confirmedRange}</span> : undefined}
          sub={`멤버 ${r.total}명 · 방장 ${r.ownerName}`}
          actions={
            <>
              <MonthNav className={styles.monthNav} month={r.month} onShift={r.shiftMonth} onToday={r.goToday} short />
              <button type="button" className="ui-btn" onClick={() => setShareOpen(true)} data-guide="room-invite">
                <Icon name="share" size={16} />
                초대
              </button>
              <button type="button" className="ui-btn ui-btn--icon" onClick={() => setSettingsOpen(true)} aria-label="모임 설정" title="모임 설정">
                <Icon name="settings" size={18} />
              </button>
              <button type="button" className="ui-btn ui-btn--primary" aria-pressed={editing} onClick={toggleEditing}>
                <Icon name="edit" size={16} />
                {editLabel}
              </button>
            </>
          }
        />
      </div>

      <div className={styles.deskOnly}>
        <MemberStrip members={r.ordered} meId={r.meId} markedIds={r.markedIds} />
      </div>

      {editing && (
        <div className={styles.editBar}>
          <span className={styles.editHint}>
            <Icon name="edit" size={16} />
            표에서 내 줄을 눌러 표시해요
          </span>
          <ModeBar
            mode={r.mode}
            onMode={r.setMode}
            afterTime={r.afterTime}
            onAfterTime={r.setAfterTime}
            onReset={r.resetMine}
            canReset={Object.keys(r.myMarks).length > 0}
            onRefresh={() => void r.reload()}
          />
        </div>
      )}

      {/* 표 (PC) / 날짜 목록 (모바일) — 둘 중 하나만 보인다 */}
      <div className={styles.matrixArea} data-guide="room-cal">
        <section className={`${styles.card} ${styles.matrixCard}`} aria-label="사람별 가능 날짜">
          <MemberMatrix
            members={r.ordered}
            meId={r.meId}
            availabilities={r.availabilities}
            summary={r.summary}
            total={r.total}
            month={r.month}
            holidays={r.holidays}
            editing={editing}
            onApply={r.applyMarks}
          />
          <ul className={`ui-legend ${styles.legend}`}>
            <li>
              <i className={`ui-legend__sw ${styles.swYes}`} aria-hidden="true" />
              가능
            </li>
            <li>
              <i className={`ui-legend__sw ${styles.swAfter}`} aria-hidden="true" />
              저녁 이후
            </li>
            <li>
              <i className={`ui-legend__sw ${styles.swNo}`} aria-hidden="true" />
              안 됨
            </li>
            <li>
              <i className={`ui-legend__sw ${styles.swAll}`} aria-hidden="true" />
              모두 가능한 날
            </li>
          </ul>
        </section>

        <div className={styles.list}>
          <MonthNav className={styles.listNav} month={r.month} onShift={r.shiftMonth} onToday={r.goToday} short />
          <MatrixList
            members={r.ordered}
            meId={r.meId}
            availabilities={r.availabilities}
            summary={r.summary}
            total={r.total}
            month={r.month}
            holidays={r.holidays}
            filter={filter}
            editing={editing}
            onApply={r.applyMarks}
          />
        </div>
      </div>

      <div className={styles.bottom}>
        <SheetPanel open={sheet === 'cands'} onClose={() => setSheet(null)} label="후보" className={styles.card}>
          <h2 className={styles.cardTitle}>후보</h2>
          <div className={styles.cardBody}>
            <CandidateList
              cands={r.cands}
              confirmed={room.confirmed}
              isOwner={r.isOwner}
              total={r.total}
              members={r.members}
              markedIds={r.markedIds}
              meId={r.meId}
              onConfirm={onConfirm}
              onUnconfirm={() => void r.unconfirm()}
            />
          </div>
        </SheetPanel>

        <SheetPanel open={sheet === 'chat'} onClose={() => setSheet(null)} label="대화" className={styles.card}>
          <h2 className={styles.cardTitle}>
            대화
            {r.unread > 0 && (
              <span className="ui-badge" aria-label={`안 읽은 메시지 ${r.unread}개`}>
                {r.unread > 99 ? '99+' : r.unread}
              </span>
            )}
          </h2>
          <RoomChat
            roomId={r.roomId}
            meId={r.meId}
            members={r.members}
            comments={r.comments}
            onRefresh={r.refreshComments}
            onSeen={r.markChatSeen}
          />
        </SheetPanel>
      </div>

      <CandidateStrip
        cands={r.cands}
        confirmed={room.confirmed}
        isOwner={r.isOwner}
        total={r.total}
        members={r.members}
        markedIds={r.markedIds}
        meId={r.meId}
        onConfirm={onConfirm}
        onMore={() => setSheet('cands')}
        onInvite={() => setShareOpen(true)}
      />

      {shareOpen && <RoomShareModal room={room} onClose={() => setShareOpen(false)} />}
      {settingsOpen && <RoomSettingsModal room={room} meId={r.meId} onChanged={() => r.reload()} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
