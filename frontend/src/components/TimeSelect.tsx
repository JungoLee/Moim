'use client';

import { HOURS, MINUTES } from '@/lib/datetime';

type Props = {
  /** 'HH:MM' */
  value: string;
  onChange: (value: string) => void;
  hourLabel?: string;
  minuteLabel?: string;
};

/** 24시 시/분 선택 한 쌍 (대시보드·요청·모임 공용). 두 개의 select 를 fragment 로 반환. */
export default function TimeSelect({ value, onChange, hourLabel = '시', minuteLabel = '분' }: Props) {
  const hh = value.slice(0, 2);
  const mm = value.slice(3);
  return (
    <>
      <select className="app-select" aria-label={hourLabel} value={hh} onChange={(e) => onChange(`${e.target.value}:${mm}`)}>
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}시</option>
        ))}
      </select>
      <select className="app-select" aria-label={minuteLabel} value={mm} onChange={(e) => onChange(`${hh}:${e.target.value}`)}>
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}분</option>
        ))}
      </select>
    </>
  );
}
