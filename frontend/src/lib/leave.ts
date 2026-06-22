// 연차 계획 — MyBudget의 "브릿지" 알고리즘 이식.
// 공휴일/주말 사이의 근무일을 연차로 메워 최소 연차로 최대 연휴를 만든다.

export type LeaveStyle = 'short' | 'balanced' | 'long';
export type Holidays = Record<string, string>; // 'YYYY-MM-DD' -> 공휴일명

export type Bridge = {
  bridgeStart: Date; // 실제 연차를 쓰는 시작일
  bridgeEnd: Date; // 실제 연차를 쓰는 종료일
  spanStart: Date; // 연차+주말+공휴일 포함 전체 휴무 시작
  spanEnd: Date; // 전체 휴무 종료
  leaveDays: number; // 사용 연차 일수
  totalDays: number; // 총 휴무 일수
  efficiency: number; // totalDays / leaveDays
  holidayNames: string[];
};

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function isHoliday(d: Date, holidays: Holidays): boolean {
  return !!holidays[toKey(d)];
}

export function isNonWorking(d: Date, holidays: Holidays): boolean {
  return isWeekend(d) || isHoliday(d, holidays);
}

export function formatDate(d: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export function getHolidayNames(start: Date, end: Date, holidays: Holidays): string[] {
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
export function findBridges(from: Date, to: Date, maxConsecutive: number, holidays: Holidays): Bridge[] {
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

// 잔여 연차/스타일 기준으로 겹치지 않는 최적 조합을 greedy 선택.
export function selectPeriods(
  bridges: Bridge[],
  remaining: number,
  style: LeaveStyle,
  _from: Date,
  _to: Date
): { selected: Bridge[]; usedDays: number } {
  let sorted: Bridge[];
  if (style === 'short') {
    const filtered = bridges.filter((b) => b.leaveDays <= 2);
    sorted = filtered.length > 0 ? filtered : bridges.filter((b) => b.leaveDays <= 3);
    sorted = [...sorted].sort((a, b) => b.efficiency - a.efficiency || a.leaveDays - b.leaveDays);
  } else if (style === 'long') {
    const filtered = bridges.filter((b) => b.leaveDays >= 3);
    sorted = filtered.length > 0 ? filtered : bridges;
    sorted = [...sorted].sort((a, b) => b.totalDays - a.totalDays || b.efficiency - a.efficiency);
  } else {
    sorted = [...bridges].sort((a, b) => b.efficiency - a.efficiency);
  }

  const selected: Bridge[] = [];
  let usedDays = 0;
  const taken = new Set<string>();

  function tryAdd(bridge: Bridge): void {
    if (usedDays + bridge.leaveDays > remaining) return;
    let cur = new Date(bridge.bridgeStart);
    while (cur.getTime() <= bridge.bridgeEnd.getTime()) {
      if (taken.has(toKey(cur))) return; // 이미 선택된 날과 겹침
      cur = addDays(cur, 1);
    }
    cur = new Date(bridge.bridgeStart);
    while (cur.getTime() <= bridge.bridgeEnd.getTime()) {
      taken.add(toKey(cur));
      cur = addDays(cur, 1);
    }
    usedDays += bridge.leaveDays;
    selected.push({ ...bridge });
  }

  for (const bridge of sorted) {
    if (usedDays >= remaining) break;
    tryAdd(bridge);
  }
  if (usedDays < remaining) {
    const sortedSet = new Set(sorted);
    const fallback = [...bridges].filter((b) => !sortedSet.has(b)).sort((a, b) => b.efficiency - a.efficiency);
    for (const bridge of fallback) {
      if (usedDays >= remaining) break;
      tryAdd(bridge);
    }
  }

  selected.sort((a, b) => a.spanStart.getTime() - b.spanStart.getTime());
  return { selected, usedDays };
}
