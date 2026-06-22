'use client';

import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DateSelectArg } from '@fullcalendar/core';
import type { MoimEvent } from '@/lib/types';

type Props = {
  events: MoimEvent[];
  /** 드래그/클릭으로 기간 선택 (대시보드: 새 일정 프리필). 없으면 읽기 전용. */
  onSelectRange?: (start: Date, end: Date) => void;
  /** 일정 클릭 (대시보드: 수정 모달). */
  onSelectEvent?: (id: string) => void;
};

export default function Calendar({ events, onSelectRange, onSelectEvent }: Props) {
  // FullCalendar 는 클라이언트에서만 렌더 (SSR/하이드레이션 이슈 회피)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((ev) => {
        const busy = ev.busy || ev.visibility === 'private';
        return {
          id: ev._id,
          title: ev.busy ? '바쁨' : ev.title || '(제목 없음)',
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          classNames: busy ? ['evt-busy'] : [],
        };
      }),
    [events]
  );

  function handleSelect(info: DateSelectArg) {
    if (!onSelectRange) return;
    // FullCalendar 의 end 는 배타적(exclusive) → 포함 마지막 날로 변환
    const lastDay = new Date(info.end);
    lastDay.setDate(lastDay.getDate() - 1);
    const end = lastDay.getTime() < info.start.getTime() ? info.start : lastDay;
    onSelectRange(info.start, end);
  }

  if (!mounted) {
    return <div className="app-card" style={{ minHeight: 420 }} aria-hidden />;
  }

  return (
    <div className="app-card">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ko"
        height="auto"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
        buttonText={{ today: '오늘', month: '월', week: '주' }}
        events={fcEvents}
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
