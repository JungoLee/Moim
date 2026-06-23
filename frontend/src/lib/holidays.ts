import { addDays, toKey, type Holidays } from './leave';

// 한국 법정공휴일 (오늘~약 5년: 2026–2031).
// - 양력 고정 공휴일과 대체공휴일은 코드가 자동 계산한다.
// - 음력 기반(설날·추석·부처님오신날)의 "당일" 날짜만 아래 LUNAR 테이블에 적어주면 된다(한국천문연구원 기준).
//   ▷ 새 연도 추가/수정: LUNAR 에 해당 연도의 음력 당일 3개만 넣으면 연휴·대체공휴일이 자동 생성됨.
//
// 대체공휴일 규칙 (관공서의 공휴일에 관한 규정 제3조):
//   · 설날·추석 연휴: "일요일"과 겹치거나 다른 공휴일과 겹치면 +1일 (토요일만 겹치는 건 제외)
//   · 어린이날 / 국경일(삼일절·제헌절·광복절·개천절·한글날) / 부처님오신날 / 성탄절: 토·일과 겹치면 +1일
//   · 신정·현충일: 대체공휴일 없음
//   · 대체일은 토·일·다른 공휴일을 건너뛴 다음 첫 평일
// (제헌절은 2026-05 대통령령으로 18년 만에 공휴일 재지정 → 2026년부터 포함)
const LUNAR: Record<number, { seollal: string; chuseok: string; buddha: string }> = {
  2026: { seollal: '2026-02-17', chuseok: '2026-09-25', buddha: '2026-05-24' },
  2027: { seollal: '2027-02-07', chuseok: '2027-09-15', buddha: '2027-05-13' },
  2028: { seollal: '2028-01-27', chuseok: '2028-10-03', buddha: '2028-05-02' },
  2029: { seollal: '2029-02-13', chuseok: '2029-09-22', buddha: '2029-05-20' },
  2030: { seollal: '2030-02-03', chuseok: '2030-09-12', buddha: '2030-05-09' },
  2031: { seollal: '2031-01-23', chuseok: '2031-10-01', buddha: '2031-04-29' },
};

type SubRule = 'none' | 'satsun' | 'lunar';
const date = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);
const parse = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const isSun = (d: Date): boolean => d.getDay() === 0;
const isSat = (d: Date): boolean => d.getDay() === 6;

function buildYear(year: number): Holidays {
  const out: Holidays = {};
  const base: Array<{ d: Date; name: string; sub: SubRule }> = [
    { d: date(year, 1, 1), name: '신정', sub: 'none' },
    { d: date(year, 3, 1), name: '삼일절', sub: 'satsun' },
    { d: date(year, 5, 5), name: '어린이날', sub: 'satsun' },
    { d: date(year, 6, 6), name: '현충일', sub: 'none' },
    { d: date(year, 8, 15), name: '광복절', sub: 'satsun' },
    { d: date(year, 10, 3), name: '개천절', sub: 'satsun' },
    { d: date(year, 10, 9), name: '한글날', sub: 'satsun' },
    { d: date(year, 12, 25), name: '성탄절', sub: 'satsun' },
  ];
  if (year >= 2026) base.push({ d: date(year, 7, 17), name: '제헌절', sub: 'satsun' });

  const lunar = LUNAR[year];
  let seollalDays: Date[] = [];
  let chuseokDays: Date[] = [];
  if (lunar) {
    base.push({ d: parse(lunar.buddha), name: '부처님오신날', sub: 'satsun' });
    seollalDays = [-1, 0, 1].map((o) => addDays(parse(lunar.seollal), o));
    chuseokDays = [-1, 0, 1].map((o) => addDays(parse(lunar.chuseok), o));
    for (const d of seollalDays) base.push({ d, name: '설날', sub: 'lunar' });
    for (const d of chuseokDays) base.push({ d, name: '추석', sub: 'lunar' });
  }

  // 기본 공휴일 집합 (같은 날 중복 시 이름 합침: 예 '개천절·추석')
  for (const b of base) {
    const k = toKey(b.d);
    out[k] = out[k] ? `${out[k]}·${b.name}` : b.name;
  }

  // 대체일 위치: 토·일·기존 공휴일을 건너뛴 다음 첫 평일
  const placeAfter = (d: Date): Date => {
    let c = addDays(d, 1);
    while (isSat(c) || isSun(c) || out[toKey(c)]) c = addDays(c, 1);
    return c;
  };

  // 토/일 대체 (단일 공휴일: 어린이날·국경일·부처님오신날·성탄절)
  for (const b of base) {
    if (b.sub === 'satsun' && (isSat(b.d) || isSun(b.d))) {
      out[toKey(placeAfter(b.d))] = `${b.name} 대체`;
    }
  }
  // 설날·추석 대체 (일요일 겹침 또는 타 공휴일 겹침)
  for (const grp of [
    { name: '설날', days: seollalDays },
    { name: '추석', days: chuseokDays },
  ]) {
    if (!grp.days.length) continue;
    const overlapSun = grp.days.some(isSun);
    const overlapHoliday = grp.days.some((d) => {
      const v = out[toKey(d)];
      return v ? v.split('·').some((p) => p !== grp.name && !p.includes('대체')) : false;
    });
    if (overlapSun || overlapHoliday) {
      out[toKey(placeAfter(grp.days[grp.days.length - 1]))] = `${grp.name} 대체`;
    }
  }
  return out;
}

export function getHolidays(years: number[]): Holidays {
  return years.reduce<Holidays>((acc, y) => ({ ...acc, ...buildYear(y) }), {});
}
