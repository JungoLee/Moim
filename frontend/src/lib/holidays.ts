import type { Holidays } from './leave';

// 매년 날짜가 고정인 양력 법정공휴일.
// 음력(설날·추석·부처님오신날)과 대체공휴일은 매년 바뀌므로 미포함 — 추후 data.go.kr API 로 확장.
// (이것만으로도 주말+고정공휴일 기준 "긴 연휴" 추천은 충분히 동작)
const FIXED: Array<[number, number, string]> = [
  [1, 1, '신정'],
  [3, 1, '삼일절'],
  [5, 5, '어린이날'],
  [6, 6, '현충일'],
  [8, 15, '광복절'],
  [10, 3, '개천절'],
  [10, 9, '한글날'],
  [12, 25, '성탄절'],
];

function fixedHolidays(year: number): Holidays {
  const out: Holidays = {};
  for (const [m, d, name] of FIXED) {
    out[`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = name;
  }
  return out;
}

export function getHolidays(years: number[]): Holidays {
  return years.reduce<Holidays>((acc, y) => ({ ...acc, ...fixedHolidays(y) }), {});
}
