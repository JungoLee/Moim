// 모임 방 집계 — 날짜별 요약과 후보 날짜 (두 보기 공용 순수 함수). docs/design-system.md 4-3.
import { addDays, dateKey, parseDateKey } from '@/lib/datetime';
import type { Mark } from '@/lib/types';

export type DaySummary = {
  yes: number;
  after: number;
  no: number;
  /** 저녁 이후 중 가장 늦은 시각 'HH:MM' (모두 모이려면 이 시각부터) */
  afterMax: string;
  /** 저녁 이후로 표시한 사람 id */
  afterIds: string[];
};

/** 사람 → 날짜 → 표시 (표 보기의 큰 표·모바일 목록 공용) */
export function marksByUser(availabilities: Record<string, Mark[]>): Record<string, Record<string, Mark>> {
  const out: Record<string, Record<string, Mark>> = {};
  for (const [uid, list] of Object.entries(availabilities)) {
    const m: Record<string, Mark> = {};
    for (const x of list) m[x.date] = x;
    out[uid] = m;
  }
  return out;
}

/** 날짜 → 요약 */
export function summarize(availabilities: Record<string, Mark[]>): Record<string, DaySummary> {
  const sum: Record<string, DaySummary> = {};
  for (const [userId, marks] of Object.entries(availabilities)) {
    for (const m of marks) {
      const s = sum[m.date] || (sum[m.date] = { yes: 0, after: 0, no: 0, afterMax: '', afterIds: [] });
      if (m.status === 'yes') s.yes++;
      else if (m.status === 'no') s.no++;
      else {
        s.after++;
        s.afterIds.push(userId);
        if (m.time && m.time > s.afterMax) s.afterMax = m.time;
      }
    }
  }
  return sum;
}

/** 히트 단계 0~5 — 전원 yes 일 때만 5 */
export function heatLevel(s: DaySummary | undefined, total: number): number {
  if (!s || total <= 0) return 0;
  if (s.yes >= total) return 5;
  return Math.round((s.yes / total) * 4);
}

export type Candidate = {
  kind: 'run' | 'full' | 'partial' | 'near';
  start: string; // 'YYYY-MM-DD'
  end: string; // 끝 포함
  days: number;
  /** partial: 저녁 이후 표시한 사람 id 와 모일 수 있는 시각 */
  afterIds: string[];
  afterMax: string;
  /** near: 되는 사람 수와 안 되는(또는 아직 안 찍은) 사람 id */
  can?: number;
  missingIds?: string[];
};

/**
 * 후보 — ① 전원 yes 가 이어진 구간(2일 이상) ② 전원 yes 하루 ③ yes+after 가 전원(시간 조율).
 * 오늘 이전은 뺀다. 같은 갈래 안에서는 날짜 순. 최대 limit 개.
 */
export function candidates(
  summary: Record<string, DaySummary>,
  total: number,
  todayKey: string,
  limit = 6
): Candidate[] {
  if (total <= 0) return [];
  const keys = Object.keys(summary)
    .filter((k) => k >= todayKey)
    .sort();
  const full = keys.filter((k) => summary[k].yes >= total);
  const partial = keys.filter((k) => {
    const s = summary[k];
    return s.no === 0 && s.yes < total && s.yes + s.after >= total;
  });

  // 전원 yes 연속 구간 묶기
  const runs: Candidate[] = [];
  const singles: Candidate[] = [];
  let i = 0;
  while (i < full.length) {
    let j = i;
    while (j + 1 < full.length) {
      const next = parseDateKey(full[j]);
      if (!next || dateKey(addDays(next, 1)) !== full[j + 1]) break;
      j++;
    }
    const c: Candidate = { kind: j > i ? 'run' : 'full', start: full[i], end: full[j], days: j - i + 1, afterIds: [], afterMax: '' };
    (j > i ? runs : singles).push(c);
    i = j + 1;
  }
  runs.sort((a, b) => b.days - a.days || a.start.localeCompare(b.start));
  const partials: Candidate[] = partial.map((k) => ({
    kind: 'partial',
    start: k,
    end: k,
    days: 1,
    afterIds: summary[k].afterIds,
    afterMax: summary[k].afterMax,
  }));
  return [...runs, ...singles, ...partials].slice(0, limit);
}

/**
 * 보조 후보 — 전원이 안 되는 날 중 '가장 많이 되는 날'. 절반 이상이 되는 날(저녁 이후 포함)을 되는 사람 수 순으로.
 * 전원 후보·시간 맞추면 되는 후보(candidates)와 겹치는 날은 뺀다. 날짜 하나씩, 최대 limit 개.
 */
export function nearCandidates(
  availabilities: Record<string, Mark[]>,
  memberIds: string[],
  todayKey: string,
  limit = 3
): Candidate[] {
  const total = memberIds.length;
  if (total < 3) return []; // 2명이면 '둘 중 하나'뿐이라 후보랄 게 없다
  const canByDate: Record<string, Set<string>> = {};
  for (const [uid, marks] of Object.entries(availabilities)) {
    for (const m of marks) {
      if (m.date < todayKey || m.status === 'no') continue;
      (canByDate[m.date] ||= new Set()).add(uid);
    }
  }
  const out: Candidate[] = [];
  for (const [date, set] of Object.entries(canByDate)) {
    const can = memberIds.filter((id) => set.has(id)).length;
    if (can >= total || can < 2 || can * 2 < total) continue;
    out.push({
      kind: 'near',
      start: date,
      end: date,
      days: 1,
      afterIds: [],
      afterMax: '',
      can,
      missingIds: memberIds.filter((id) => !set.has(id)),
    });
  }
  out.sort((a, b) => (b.can ?? 0) - (a.can ?? 0) || a.start.localeCompare(b.start));
  return out.slice(0, limit);
}
