'use client';

import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DateSelectArg } from '@fullcalendar/core';
import type { MoimEvent } from '@/lib/types';
import { eventColor, readableText } from '@/lib/colors';

type Props = {
  events: MoimEvent[];
  /** 드래그/클릭으로 기간 선택 (대시보드: 새 일정 프리필). 없으면 읽기 전용. */
  onSelectRange?: (start: Date, end: Date) => void;
  /** 일정 클릭 (대시보드: 수정 모달). */
  onSelectEvent?: (id: string) => void;
  /** 그룹 id → 색상. 비공개+그룹지정 일정의 라인 색을 그룹 색으로 칠한다. */
  tierColors?: Record<string, string>;
};

export default function Calendar({ events, onSelectRange, onSelectEvent, tierColors }: Props) {
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
        // 볼 수 없는 일정(busy): 회색 + 시간 숨김(종일 블록) — 주 뷰에서도 시간대 미노출
        if (ev.busy) {
          return {
            id: ev._id,
            title: '비공개 일정',
            start: ev.start,
            end: ev.end,
            allDay: true,
            classNames: ['evt-busy'],
          };
        }
        // 그 외: 공개=초록 / 비공개=주황 / 비공개+그룹지정=그룹색
        const color = eventColor(ev, tierColors);
        return {
          id: ev._id,
          title: ev.title || '(제목 없음)',
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          backgroundColor: color,
          borderColor: color,
          textColor: readableText(color),
        };
      }),
    [events, tierColors]
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
