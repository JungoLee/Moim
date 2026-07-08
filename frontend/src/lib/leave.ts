// 연차 계획 — MyBudget의 "브릿지" 알고리즘 이식.
// 공휴일/주말 사이의 근무일을 연차로 메워 최소 연차로 최대 연휴를 만든다.

// 날짜 헬퍼는 공용(lib/datetime)을 재사용 — 중복 정의 제거. (기존 import 호환 위해 이름 유지)
import { addDays, dateKey } from '@/lib/datetime';
export { addDays };
export const toKey = dateKey;

export type LeaveStyle = 'short' | 'balanced' | 'long';
export type Holidays = Record<string, string>; // 'YYYY-MM-DD' -> 공휴일명

export type Bridge = {
  bridgeStart: Date; // 실제 연차를 쓰는 시작일
  bridgeEnd: Date; // 실제 연차를 쓰는 종료일
  spanStart: Date; // 연차+주말+공휴일 포함 전체 휴무 시작
  spanEnd: Date; // 전체 휴무 종료
  leaveDays: number; // 사용 연차 일수
  totalDays: number; // 총 휴무 일수
  efficiency: number; // totalDays / leaveDays (연차 1일당 휴무 — "짧게/균형"에서 가성비 기준)
  score: number; // totalDays*2 - leaveDays (순이익 — "길게 몰아서"에서 긴 연휴 우선 기준)
  holidayNames: string[];
};


function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isHoliday(d: Date, holidays: Holidays): boolean {
  return !!holidays[toKey(d)];
}

function isNonWorking(d: Date, holidays: Holidays): boolean {
  return isWeekend(d) || isHoliday(d, holidays);
}

export function formatDate(d: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  // YYYY-MM-DD (요일) — 연도 포함, 월/일 한글 표기 없이
  return `${toKey(d)} (${days[d.getDay()]})`;
}

// 표시용 지표: '길게 몰아서'는 순이익 점수(+N점), 그 외는 효율(Nx)
export function metricLabel(b: Bridge, style: LeaveStyle): string {
  return style === 'long' ? `+${b.score}점` : `${b.efficiency}x`;
}

function getHolidayNames(start: Date, end: Date, holidays: Holidays): string[] {
  const names = new Set<string>();
  let cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    const name = holidays[toKey(cur)];
    if (name) names.add(name);
    cur = addDays(cur, 1);
  }
  return [...names];
}

// from~to 범위에서 모든 "브릿지" 후보를 찾는다.
function findBridges(from: Date, to: Date, maxConsecutive: number, holidays: Holidays): Bridge[] {
  const bridges: Bridge[] = [];
  let i = new Date(from);

  function makeBridge(bStart: Date, bEnd: Date, leaveDays: number): Bridge | null {
    const dayBefore = addDays(bStart, -1);
    const dayAfter = addDays(bEnd, 1);
    const hasLeft = isNonWorking(dayBefore, holidays);
    const hasRight = isNonWorking(dayAfter, holidays);
    if (!hasLeft && !hasRight) return null; // 양쪽 다 근무일이면 휴무로 연결 안 됨

    let spanStart = new Date(bStart);
    if (hasLeft) {
      let tmp = addDays(bStart, -1);
      while (isNonWorking(tmp, holidays)) {
        spanStart = new Date(tmp);
        tmp = addDays(tmp, -1);
      }
    }

    let spanEnd = new Date(bEnd);
    if (hasRight) {
      let tmp = addDays(bEnd, 1);
      while (tmp.getTime() <= to.getTime() && isNonWorking(tmp, holidays)) {
        spanEnd = new Date(tmp);
        tmp = addDays(tmp, 1);
      }
    }

    let totalDays = 0;
    let cur = new Date(spanStart);
    while (cur.getTime() <= spanEnd.getTime()) {
      totalDays++;
      cur = addDays(cur, 1);
    }

    return {
      bridgeStart: new Date(bStart),
      bridgeEnd: new Date(bEnd),
      spanStart,
      spanEnd,
      leaveDays,
      totalDays,
      efficiency: Math.round((totalDays / leaveDays) * 10) / 10,
      score: totalDays * 2 - leaveDays,
      holidayNames: getHolidayNames(spanStart, spanEnd, holidays),
    };
  }

  while (i.getTime() <= to.getTime()) {
    if (!isNonWorking(i, holidays)) {
      const runDays: Date[] = [];
      while (i.getTime() <= to.getTime() && !isNonWorking(i, holidays)) {
        runDays.push(new Date(i));
        i = addDays(i, 1);
      }
      const workDays = runDays.length;

      if (workDays <= maxConsecutive) {
        const b = makeBridge(runDays[0], runDays[workDays - 1], workDays);
        if (b) bridges.push(b);
      }
      // 부분 구간(run 내 더 짧은 연속) 후보
      if (workDays > 1) {
        for (let s = 0; s < workDays; s++) {
          for (let e = s; e < workDays; e++) {
            const len = e - s + 1;
            if (len === workDays) continue;
            if (len > maxConsecutive) continue;
            const b = makeBridge(runDays[s], runDays[e], len);
            if (b) bridges.push(b);
          }
        }
      }
    } else {
      i = addDays(i, 1);
    }
  }

  return bridges;
}

// 잔여 연차/스타일 기준으로 겹치지 않는 최적 조합을 선택한다.
// 1) 공휴일을 끼는 구간(어린이날·한글날 등 연휴)을 먼저 확보 — 효율 숫자가 일반 주말(3.0x)보다
//    낮아도(예: 어린이날 5일·2.5x) 사람에겐 더 가치 있다.
// 2) 남는 연차는 일반 주말 구간으로 채우되 1년에 "고르게 분산"(farthest-point) — 한쪽(여름)에
//    몰려서 8월 이후가 텅 비는 현상을 막는다. 거리를 2주 단위로 묶어, 같은 거리대면 효율 높은
//    1일짜리 구간을 우선한다.
const DAY_MS = 86_400_000;

function selectPeriods(
  bridges: Bridge[],
  remaining: number,
  style: LeaveStyle,
  from: Date,
  to: Date
): { selected: Bridge[]; usedDays: number } {
  // 스타일별 후보 풀 — 짧게는 연차 1~2일짜리로 한정, 균형·길게는 전체에서 정렬로 차별화
  let pool: Bridge[];
  if (style === 'short') {
    const f = bridges.filter((b) => b.leaveDays <= 2);
    pool = f.length > 0 ? f : bridges.filter((b) => b.leaveDays <= 3);
  } else {
    pool = [...bridges];
  }
  // 가치 비교(스타일별):
  //  · 짧게 여러 번 = 가성비(효율) + 연차 적은 것 → 1일짜리 여러 번
  //  · 균형        = 효율 우선, 동률이면 더 긴 쪽
  //  · 길게 몰아서 = 순이익 점수(휴무×2 − 연차) → 긴 연휴 우선  ← 사용자가 말한 스타일
  const byValue = (a: Bridge, b: Bridge): number => {
    if (style === 'long') return b.score - a.score || b.totalDays - a.totalDays || a.leaveDays - b.leaveDays;
    if (style === 'short') return b.efficiency - a.efficiency || a.leaveDays - b.leaveDays || b.score - a.score;
    return b.efficiency - a.efficiency || b.score - a.score || b.totalDays - a.totalDays;
  };

  const selected: Bridge[] = [];
  let usedDays = 0;
  const taken = new Set<string>();
  const mid = (b: Bridge): number => (b.spanStart.getTime() + b.spanEnd.getTime()) / 2;

  // 겹침은 "휴무 기간 전체(span)" 기준으로 검사 — 같은 주말을 양쪽에서 끼는 두 구간이 중복 선택돼
  // 휴무일이 부풀려지는 것을 막는다.
  function fits(b: Bridge): boolean {
    if (usedDays + b.leaveDays > remaining) return false;
    let cur = new Date(b.spanStart);
    while (cur.getTime() <= b.spanEnd.getTime()) {
      if (taken.has(toKey(cur))) return false;
      cur = addDays(cur, 1);
    }
    return true;
  }
  function commit(b: Bridge): void {
    let cur = new Date(b.spanStart);
    while (cur.getTime() <= b.spanEnd.getTime()) {
      taken.add(toKey(cur));
      cur = addDays(cur, 1);
    }
    usedDays += b.leaveDays;
    selected.push({ ...b });
  }

  // 1차: 공휴일 낀 구간을 가치순으로 확보
  for (const b of pool.filter((x) => x.holidayNames.length > 0).sort(byValue)) {
    if (usedDays >= remaining) break;
    if (fits(b)) commit(b);
  }

  // 2차: 일반 주말 구간을 farthest-point 로 고르게 분산
  const weekend = pool.filter((x) => x.holidayNames.length === 0);
  while (usedDays < remaining) {
    const anchors = [from.getTime(), to.getTime(), ...selected.map(mid)];
    let best: Bridge | null = null;
    let bestBand = -1;
    for (const b of weekend) {
      if (!fits(b)) continue;
      const m = mid(b);
      const band = Math.floor(Math.min(...anchors.map((a) => Math.abs(m - a))) / (14 * DAY_MS));
      if (band > bestBand || (band === bestBand && best !== null && byValue(b, best) < 0)) {
        best = b;
        bestBand = band;
      }
    }
    if (!best) break;
    commit(best);
  }

  // 3차(폴백): 스타일 풀이 모자라면 전체 후보로 채움
  if (usedDays < remaining) {
    for (const b of [...bridges].sort(byValue)) {
      if (usedDays >= remaining) break;
      if (fits(b)) commit(b);
    }
  }

  selected.sort((a, b) => a.spanStart.getTime() - b.spanStart.getTime());
  return { selected, usedDays };
}

export type LeavePlan = {
  combo: Bridge[]; // 겹치지 않는 추천 조합
  comboLeave: number; // 사용 연차 합
  comboOff: number; // 총 휴무일 합
  candidates: Bridge[]; // 전체 후보(공휴일 우선 정렬)
};

// 연차 계획 한 번에 계산 — 연차 페이지와 홈 카드가 공유.
export function computeLeavePlan(
  from: Date,
  to: Date,
  remaining: number,
  maxConsec: number,
  style: LeaveStyle,
  holidays: Holidays
): LeavePlan {
  const bridges = findBridges(from, to, maxConsec, holidays);
  // 효율 2.0x 미만 제거 + 동일 기간 중복 제거
  const seen = new Set<string>();
  const deduped = bridges.filter((b) => {
    if (b.efficiency < 2.0) return false;
    const key = `${toKey(b.bridgeStart)}~${toKey(b.bridgeEnd)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 후보 목록 (짧게만 연차 1~2일로 한정 + 공휴일 우선 + 스타일별 정렬)
  let candidates = deduped;
  if (style === 'short') {
    const s = candidates.filter((c) => c.leaveDays <= 2);
    if (s.length) candidates = s;
  }
  const hol = (b: Bridge): number => (b.holidayNames.length > 0 ? 1 : 0);
  candidates = [...candidates].sort(
    (a, b) =>
      hol(b) - hol(a) ||
      (style === 'long'
        ? b.score - a.score || b.totalDays - a.totalDays
        : b.efficiency - a.efficiency || b.score - a.score)
  );

  const { selected, usedDays } = selectPeriods(deduped, remaining, style, from, to);
  const comboOff = selected.reduce((s, p) => s + p.totalDays, 0);
  return { combo: selected, comboLeave: usedDays, comboOff, candidates };
}
