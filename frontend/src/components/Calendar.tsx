'use client';

import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DateSelectArg } from '@fullcalendar/core';
import type { MoimEvent } from '@/lib/types';
import { eventColor, readableText } from '@/lib/colors';
import { addDays, dateKey } from '@/lib/datetime';

// 모든 달력 제목을 "YYYY-MM" 으로 (월 0-based)
const ymTitle = (arg: { date: { year: number; month: number } }) =>
  `${arg.date.year}-${String(arg.date.month + 1).padStart(2, '0')}`;

// FullCalendar 의 종일(allDay) end 는 '배타적'(다음 날)이라, 우리 데이터의 포함 끝(마지막 날 23:59)을
// +1일 날짜로 바꿔야 마지막 날까지 칠해진다. 종일은 날짜 문자열로 넘겨 타임존 영향도 제거.
function fcRange(start: string, end: string, allDay?: boolean): { start: string; end: string } {
  if (!allDay) return { start, end };
  return { start: dateKey(new Date(start)), end: dateKey(addDays(new Date(end), 1)) };
}

type Props = {
  events: MoimEvent[];
  /** 드래그/클릭으로 기간 선택 (대시보드: 새 일정 프리필). allDay=월 뷰(종일), false=주 뷰(시간 지정). 없으면 읽기 전용. */
  onSelectRange?: (start: Date, end: Date, allDay: boolean) => void;
  /** 일정 클릭 (대시보드: 수정 모달). */
  onSelectEvent?: (id: string) => void;
  /** 그룹 id → 색상. 비공개+그룹지정 일정의 라인 색을 그룹 색으로 칠한다. */
  tierColors?: Record<string, string>;
  /** 내가 보낸(대기 중) 시간 요청 — 연한 색 블록으로 함께 표시 */
  requests?: { _id: string; title: string; start: string; end: string; allDay?: boolean }[];
};

export default function Calendar({ events, onSelectRange, onSelectEvent, tierColors, requests }: Props) {
  // FullCalendar 는 클라이언트에서만 렌더 (SSR/하이드레이션 이슈 회피)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const fcEvents: EventInput[] = useMemo(() => {
    const evs: EventInput[] = events.map((ev) => {
      // 볼 수 없는 일정(busy): 회색 + 시간 숨김(종일 블록) — 주 뷰에서도 시간대 미노출
      if (ev.busy) {
        return {
          id: ev._id,
          title: '비공개 일정',
          ...fcRange(ev.start, ev.end, true),
          allDay: true,
          classNames: ['evt-busy'],
        };
      }
      // 그 외: 공개=초록 / 비공개=주황 / 비공개+그룹지정=그룹색
      const color = eventColor(ev, tierColors);
      return {
        id: ev._id,
        title: ev.title || '(제목 없음)',
        ...fcRange(ev.start, ev.end, ev.allDay),
        allDay: ev.allDay,
        backgroundColor: color,
        borderColor: color,
        textColor: readableText(color),
      };
    });
    // 내가 보낸 대기 중 시간 요청 — 연한 점선 블록으로 표시 (클릭/수정 대상 아님)
    const reqs: EventInput[] = (requests || []).map((r) => ({
      id: `req-${r._id}`,
      title: `🕖 ${r.title}`,
      ...fcRange(r.start, r.end, r.allDay),
      allDay: r.allDay,
      display: 'block',
      classNames: ['evt-request'],
    }));
    return [...evs, ...reqs];
  }, [events, tierColors, requests]);

  function handleSelect(info: DateSelectArg) {
    if (!onSelectRange) return;
    // 월 뷰만 사용 → 선택은 항상 종일. end 는 배타적(다음날) → 포함 마지막 날로 변환
    const lastDay = new Date(info.end);
    lastDay.setDate(lastDay.getDate() - 1);
    const end = lastDay.getTime() < info.start.getTime() ? info.start : lastDay;
    onSelectRange(info.start, end, true);
  }

  if (!mounted) {
    return <div className="app-card" style={{ minHeight: 420 }} aria-hidden />;
  }

  return (
    <div className="app-card">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ko"
        height="auto"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        titleFormat={ymTitle}
        buttonText={{ today: '오늘' }}
        events={fcEvents}
        eventDisplay="block"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        selectable={!!onSelectRange}
        selectMirror
        unselectAuto={false}
        selectAllow={(arg) => arg.start.getTime() >= today.getTime()}
        select={onSelectRange ? handleSelect : undefined}
        eventClick={onSelectEvent ? (info) => onSelectEvent(info.event.id) : undefined}
        dayMaxEvents={3}
        firstDay={0}
        fixedWeekCount={false}
      />
    </div>
  );
}
