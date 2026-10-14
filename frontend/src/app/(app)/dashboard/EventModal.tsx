'use client';

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import DatePicker from '@/components/DatePicker';
import Modal from '@/components/Modal';
import TimeSelect from '@/components/TimeSelect';
import Icon from '@/components/Icon';
import { DEFAULT_TIER_COLOR } from '@/lib/colors';
import { fmtDayShort, fmtTime } from '@/lib/datetime';
import type { MoimEvent, Tier } from '@/lib/types';
import styles from './dashboard.module.scss';

/** 일정 팝업 입력값 — 시각은 로컬 'HH:MM', 저장할 때 ISO 로 바꾼다 */
export type EventForm = {
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  location: string;
  memo: string;
  visibility: 'public' | 'private';
  /** 비공개일 때 자세히 보여줄 그룹 id (비면 나만) */
  tierIds: string[];
};

type Props = {
  mode: 'create' | 'edit';
  initial: EventForm;
  tiers: Tier[];
  /** DatePicker 점 표시 — 내 일정이 있는 날 */
  markedDates: Record<string, string>;
  /** 자동으로 만들어진 일정의 출처 (시간 요청 · 모임 확정) */
  origin?: MoimEvent['origin'];
  onClose: () => void;
  onSave: (form: EventForm) => Promise<void>;
  onDelete?: () => Promise<void>;
};

/** 출처 안내 — 시간 요청이면 ui-chip--req + 누가·언제, 모임 확정이면 ui-chip--primary + 방 이름 */
function OriginNote({ origin }: { origin: NonNullable<MoimEvent['origin']> }) {
  if (origin.kind === 'timeRequest') {
    const req = origin.requestedAt ? new Date(origin.requestedAt) : null;
    return (
      <p className={styles.origin}>
        <span className="ui-chip ui-chip--req">시간 요청</span>
        <span>
          <strong>{origin.fromName}</strong> → <strong>{origin.toName}</strong> 요청을 수락해 만들어진 일정이에요
          {req && ` · ${fmtDayShort(req)} ${fmtTime(req)} 요청`}
        </span>
      </p>
    );
  }
  if (origin.kind === 'room') {
    return (
      <p className={styles.origin}>
        <span className="ui-chip ui-chip--primary">{`모임 “${origin.toName}”에서 확정`}</span>
        <span>방장 {origin.fromName} 님이 확정한 날짜예요</span>
      </p>
    );
  }
  return null;
}

/** 새 일정 · 일정 수정 팝업 (docs 6-5) */
export default function EventModal({ mode, initial, tiers, markedDates, origin, onClose, onSave, onDelete }: Props) {
  const formId = useId();
  const [f, setF] = useState<EventForm>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.startDate || !f.endDate || saving) return;
    setSaving(true);
    try {
      await onSave(f);
    } finally {
      setSaving(false);
    }
  }

  function toggleTier(id: string) {
    set('tierIds', f.tierIds.includes(id) ? f.tierIds.filter((t) => t !== id) : [...f.tierIds, id]);
  }

  return (
    <Modal
      onClose={onClose}
      title={mode === 'edit' ? '일정' : '새 일정'}
      footer={
        <div className="ui-actions">
          {mode === 'edit' && onDelete && (
            <button type="button" className="ui-btn ui-btn--danger" onClick={onDelete} disabled={saving}>
              <Icon name="trash" size={16} />
              삭제
            </button>
          )}
          <span className="ui-spacer" />
          <button type="button" className="ui-btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" form={formId} className="ui-btn ui-btn--primary" disabled={saving}>
            저장
          </button>
        </div>
      }
    >
      <form id={formId} className="ui-form" onSubmit={submit}>
        {origin && <OriginNote origin={origin} />}

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${formId}-title`}>
            제목
          </label>
          <input
            id={`${formId}-title`}
            className="ui-input"
            placeholder="일정 제목"
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>

        <label className="ui-switch">
          <input type="checkbox" role="switch" checked={f.allDay} onChange={(e) => set('allDay', e.target.checked)} />
          <span className="ui-switch__track" aria-hidden />
          <span>종일</span>
        </label>

        {/* 종일이면 시작·종료 날짜를 한 줄에 나란히 (시각이 붙으면 한 줄에 하나) */}
        <div className={styles.range} data-allday={f.allDay || undefined}>
        <div className="ui-field">
          <span className="ui-label" id={`${formId}-start`}>
            시작
          </span>
          <div className={styles.dt} role="group" aria-labelledby={`${formId}-start`}>
            <div className={styles.dtDate}>
              <DatePicker value={f.startDate} onChange={(v) => set('startDate', v)} markedDates={markedDates} block ariaLabel="시작 날짜" />
            </div>
            {!f.allDay && (
              <TimeSelect value={f.startTime} onChange={(v) => set('startTime', v)} hourLabel="시작 시" minuteLabel="시작 분" />
            )}
          </div>
        </div>

        <div className="ui-field">
          <span className="ui-label" id={`${formId}-end`}>
            종료
          </span>
          <div className={styles.dt} role="group" aria-labelledby={`${formId}-end`}>
            <div className={styles.dtDate}>
              <DatePicker value={f.endDate} onChange={(v) => set('endDate', v)} markedDates={markedDates} block ariaLabel="종료 날짜" alignEnd={f.allDay} />
            </div>
            {!f.allDay && <TimeSelect value={f.endTime} onChange={(v) => set('endTime', v)} hourLabel="종료 시" minuteLabel="종료 분" />}
          </div>
        </div>
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${formId}-loc`}>
            장소 <span className="ui-muted">(선택)</span>
          </label>
          <input
            id={`${formId}-loc`}
            className="ui-input"
            placeholder="예: 강남역 2번 출구"
            value={f.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={`${formId}-memo`}>
            메모 <span className="ui-muted">(선택)</span>
          </label>
          <textarea
            id={`${formId}-memo`}
            className="ui-textarea"
            placeholder="예: 준비물, 예약 번호"
            rows={3}
            value={f.memo}
            onChange={(e) => set('memo', e.target.value)}
          />
        </div>

        <div className="ui-field">
          <span className="ui-label" id={`${formId}-share`}>
            공개 범위
          </span>
          <div className="ui-seg" role="group" aria-labelledby={`${formId}-share`}>
            <button type="button" aria-pressed={f.visibility === 'public'} onClick={() => set('visibility', 'public')}>
              공개
            </button>
            <button type="button" aria-pressed={f.visibility === 'private'} onClick={() => set('visibility', 'private')}>
              비공개
            </button>
          </div>
          {f.visibility === 'public' ? (
            <p className="ui-help">친구 모두가 제목과 내용을 볼 수 있어요.</p>
          ) : tiers.length === 0 ? (
            <p className="ui-help">친구에게는 “바쁨”으로만 보여요. 그룹을 만들면 그 그룹에게만 자세히 보여줄 수 있어요.</p>
          ) : (
            <>
              <p className="ui-help">친구에게는 “바쁨”으로만 보여요. 아래에서 고른 그룹에게만 자세히 보여요.</p>
              <div className={styles.chips} role="group" aria-label="자세히 보여줄 그룹">
                {tiers.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={f.tierIds.includes(t._id)}
                    onClick={() => toggleTier(t._id)}
                  >
                    {/* 그룹 색은 데이터 값 */}
                    <span className={styles.chipDot} style={{ background: t.color || DEFAULT_TIER_COLOR }} aria-hidden />
                    {t.name}
                    {f.tierIds.includes(t._id) && <Icon name="check" size={14} stroke={2.6} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
