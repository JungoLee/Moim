'use client';

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Calendar from '@/components/Calendar';
import ColorPalette from '@/components/ColorPalette';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import { useShell } from '@/components/shell/ShellContext';
import { api, getToken } from '@/lib/api';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';
import { allDayIsoRange, dateKey, timeKey } from '@/lib/datetime';
import { buildMarkedDates } from '@/lib/marks';
import { PUBLIC_COLOR, PRIVATE_COLOR, REQUEST_COLOR, ROOM_COLOR, DEFAULT_TIER_COLOR } from '@/lib/colors';
import { useOutsideClose } from '@/lib/useOutsideClose';
import { useEscClose } from '@/lib/useEscClose';
import type { MoimEvent, Tier, TimeRequest } from '@/lib/types';
import EventModal, { type EventForm } from './EventModal';
import styles from './dashboard.module.scss';

type ModalState = { mode: 'create' | 'edit'; editId: string; initial: EventForm; origin?: MoimEvent['origin'] };

const BLANK: EventForm = {
  title: '',
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  allDay: true,
  location: '',
  memo: '',
  visibility: 'public',
  tierIds: [],
};

/** ?new=1 로 들어오면(사이드바·홈의 [새 일정]) 새 일정 팝업을 바로 연다. 열고 나면 주소에서 지운다 */
function OpenOnNew({ onOpen }: { onOpen: () => void }) {
  const router = useRouter();
  const flag = useSearchParams().get('new');
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  useEffect(() => {
    if (flag !== '1') return;
    openRef.current();
    router.replace('/dashboard');
  }, [flag, router]);
  return null;
}

export default function Dashboard() {
  const router = useRouter();
  const { me } = useShell();
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sentRequests, setSentRequests] = useState<TimeRequest[]>([]);
  const [error, setError] = useState('');
  // 범례에서 팔레트가 열린 그룹 id (없으면 null)
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  const legendRef = useRef<HTMLDivElement>(null);
  useOutsideClose(legendRef, paletteFor !== null, () => setPaletteFor(null));
  useEscClose(() => setPaletteFor(null), paletteFor !== null);

  const loadTiers = useCallback(async () => {
    try {
      const tRes = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(tRes.tiers);
    } catch {
      /* 그룹 로드 실패는 흐름을 막지 않음 */
    }
  }, []);

  // 일정·보낸 요청·그룹을 한꺼번에
  const load = useCallback(async () => {
    const [ev, sent] = await Promise.all([
      api<{ events: MoimEvent[] }>('/api/events').catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '일정을 불러오지 못했어요. 화면을 새로고침해 주세요.');
        return null;
      }),
      api<{ requests: TimeRequest[] }>('/api/requests/sent').catch(() => null),
      loadTiers(),
    ]);
    if (ev) {
      setEvents(ev.events);
      setError('');
    }
    if (sent) setSentRequests(sent.requests.filter((r) => r.status === 'pending'));
  }, [loadTiers]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  // 그룹 id → 색상 (캘린더 라인 색칠에 사용)
  const tierColors = useMemo(
    () => Object.fromEntries(tiers.map((t) => [t._id, t.color || DEFAULT_TIER_COLOR])),
    [tiers]
  );

  // 날짜 → 색 (DatePicker 에 내 일정을 점으로 표시)
  const markedDates = useMemo(() => buildMarkedDates({ events, tierColors }), [events, tierColors]);

  // 달력 클릭/드래그 → 생성 팝업. allDay=월 뷰(종일 기본), false=시간 선택
  function openCreate(startDay: Date, endDay: Date, allDay = true) {
    loadTiers();
    setModal({
      mode: 'create',
      editId: '',
      initial: {
        ...BLANK,
        startDate: dateKey(startDay),
        startTime: allDay ? '09:00' : timeKey(startDay),
        endDate: dateKey(endDay),
        endTime: allDay ? '10:00' : timeKey(endDay),
        allDay,
      },
    });
  }

  function openToday() {
    const t = new Date();
    openCreate(t, t);
  }

  // 일정 클릭 → 수정 팝업 (시간 요청 일정은 상대가 지웠는지 먼저 안내)
  async function openEdit(id: string) {
    const ev = events.find((e) => e._id === id);
    if (!ev) return;
    if (ev.origin?.kind === 'timeRequest' && ev.originPartnerGone) {
      const myName = me ? displayName(me) : '';
      const other = (ev.origin.fromName === myName ? ev.origin.toName : ev.origin.fromName) || '상대방';
      const del = await confirmDialog({
        message: `${other}님이 이 일정을 자신의 캘린더에서 삭제했어요.\n내 캘린더에서도 삭제할까요? (취소하면 그대로 두고 수정 창을 열어요)`,
        confirmText: '나도 삭제',
        danger: true,
      });
      if (del) {
        try {
          await api(`/api/events/${id}`, { method: 'DELETE' });
          load();
          toast('일정을 삭제했어요');
        } catch (err) {
          toast(err instanceof Error ? err.message : '삭제하지 못했어요', 'error');
        }
        return;
      }
    }
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    loadTiers();
    setModal({
      mode: 'edit',
      editId: id,
      origin: ev.origin,
      initial: {
        title: ev.title || '',
        startDate: dateKey(s),
        startTime: timeKey(s),
        endDate: dateKey(e),
        endTime: timeKey(e),
        allDay: !!ev.allDay,
        location: ev.location || '',
        memo: ev.memo || '',
        visibility: ev.visibility === 'private' ? 'private' : 'public',
        tierIds: ev.visibility === 'private' ? ev.audienceTiers || [] : [],
      },
    });
  }

  async function save(f: EventForm) {
    if (!modal) return;
    // 로컬 wall-clock 을 UTC instant(ISO)로 보낸다 — 서버(UTC)·클라(KST) 왕복에서
    // 무-타임존 문자열이 하루 밀리는 버그 방지. 종일은 00:00~23:59.
    const range = f.allDay
      ? allDayIsoRange(f.startDate, f.endDate)
      : {
          start: new Date(`${f.startDate}T${f.startTime}`).toISOString(),
          end: new Date(`${f.endDate}T${f.endTime}`).toISOString(),
        };
    const isPrivate = f.visibility === 'private';
    const body = {
      title: f.title.trim() || '새 일정',
      ...range,
      allDay: f.allDay,
      location: f.location.trim(),
      memo: f.memo,
      visibility: f.visibility,
      audienceTiers: isPrivate ? f.tierIds : [],
    };
    try {
      if (modal.mode === 'edit' && modal.editId) await api(`/api/events/${modal.editId}`, { method: 'PATCH', body });
      else await api('/api/events', { method: 'POST', body });
      setModal(null);
      load();
      toast(modal.mode === 'edit' ? '일정을 수정했어요' : '일정을 추가했어요', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '저장하지 못했어요', 'error');
    }
  }

  async function remove() {
    if (!modal?.editId) return;
    // 일정 하나만 지워진다 — 시간 요청·모임 확정으로 생긴 일정은 다른 사람 캘린더에 그대로 남는다는 말을 붙인다
    const kind = modal.origin?.kind;
    const extra =
      kind === 'timeRequest'
        ? '\n상대방 캘린더의 같은 일정은 그대로 남아요.'
        : kind === 'room'
          ? '\n모임의 확정 날짜와 다른 멤버의 일정은 그대로예요.'
          : '';
    const title = modal.initial.title.trim() || '새 일정';
    const ok = await confirmDialog({
      message: `'${title}' 일정을 삭제할까요?\n되돌릴 수 없어요.${extra}`,
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/events/${modal.editId}`, { method: 'DELETE' });
      setModal(null);
      load();
      toast('일정을 삭제했어요');
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요', 'error');
    }
  }

  // 범례에서 그룹 색 변경 (그룹만 — 공개/비공개 제외)
  async function updateTierColor(tierId: string, color: string) {
    try {
      await api(`/api/tiers/${tierId}`, { method: 'PATCH', body: { color } });
      await loadTiers();
    } catch (err) {
      toast(err instanceof Error ? err.message : '색을 바꾸지 못했어요', 'error');
    }
  }

  const paletteTier = tiers.find((t) => t._id === paletteFor);

  return (
    <div className="ui-page">
      <Suspense fallback={null}>
        <OpenOnNew onOpen={openToday} />
      </Suspense>

      <PageHeader
        title="내 캘린더"
        sub="날짜를 누르거나 끌어서 일정을 넣어요"
        actions={
          <button type="button" className="ui-btn ui-btn--primary" onClick={openToday} data-guide="cal-new">
            <Icon name="plus" size={16} stroke={2.4} />새 일정
          </button>
        }
      />
      {error && (
        <p className="ui-error" role="alert">
          {error}
        </p>
      )}

      <div data-guide="cal">
        <Calendar events={events} onSelectRange={openCreate} onSelectEvent={openEdit} tierColors={tierColors} requests={sentRequests} />
      </div>

      <div className={`ui-legend ${styles.legend}`} data-guide="cal-legend" ref={legendRef}>
        {/* 색 칸은 일정 종류가 정한 값이라 인라인 */}
        <span>
          <i className="ui-legend__sw" style={{ background: PUBLIC_COLOR }} />
          공개
        </span>
        <span>
          <i className="ui-legend__sw" style={{ background: PRIVATE_COLOR }} />
          비공개
        </span>
        <span>
          <i className="ui-legend__sw" style={{ background: REQUEST_COLOR }} />
          시간 요청
        </span>
        <span>
          <i className="ui-legend__sw" style={{ background: ROOM_COLOR }} />
          모임 확정
        </span>
        <span>
          <i className={`ui-legend__sw ${styles.swPending}`} />
          답 기다리는 요청
        </span>
        {tiers.map((t) => (
          <button
            key={t._id}
            type="button"
            className={styles.legendBtn}
            aria-expanded={paletteFor === t._id}
            aria-label={`${t.name} 그룹 색 바꾸기`}
            onClick={() => setPaletteFor(paletteFor === t._id ? null : t._id)}
          >
            <i className="ui-legend__sw" style={{ background: t.color || DEFAULT_TIER_COLOR }} />
            {t.name}
          </button>
        ))}
        {paletteTier && (
          <div className={`ui-popover ${styles.palettePop}`}>
            <p className={styles.paletteTitle}>{paletteTier.name} 그룹 색</p>
            <ColorPalette
              value={paletteTier.color || DEFAULT_TIER_COLOR}
              onChange={(hex) => {
                updateTierColor(paletteTier._id, hex);
                setPaletteFor(null);
              }}
            />
          </div>
        )}
      </div>

      {modal && (
        <EventModal
          mode={modal.mode}
          initial={modal.initial}
          tiers={tiers}
          markedDates={markedDates}
          origin={modal.origin}
          onClose={() => setModal(null)}
          onSave={save}
          onDelete={modal.mode === 'edit' ? remove : undefined}
        />
      )}
    </div>
  );
}
