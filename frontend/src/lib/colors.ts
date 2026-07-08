import type { MoimEvent } from './types';

// 그룹(Tier) 라인 색상 팔레트 — 모두 흰 글씨가 읽히는 중간 톤
export const TIER_PALETTE = [
  '#7c8cff', // 인디고
  '#2bb6a3', // 틸
  '#e8568a', // 핑크
  '#d98a2b', // 앰버
  '#8b5cf6', // 바이올렛
  '#3b9fd4', // 스카이
  '#3fae73', // 그린
  '#e05656', // 레드
];

export const DEFAULT_TIER_COLOR = TIER_PALETTE[0];

// 가시성 기반 기본 색
export const PUBLIC_COLOR = '#35c08a'; // 공개(공유)
export const PRIVATE_COLOR = '#e08a3c'; // 비공개(나만)
export const REQUEST_COLOR = '#a855f7'; // 시간 요청으로 만들어진 일정 (보낸 요청 점선 블록과 같은 보라 계열)

// 일정 라인 색: 시간요청 출신=보라(고정) / 공개=초록 / 비공개=주황 / 비공개+그룹지정=그룹색
export function eventColor(ev: MoimEvent, tierColors?: Record<string, string>): string {
  if (ev.origin?.kind === 'timeRequest') return REQUEST_COLOR;
  if (ev.visibility === 'private') {
    const tid = ev.audienceTiers?.[0];
    return (tid && tierColors?.[tid]) || PRIVATE_COLOR;
  }
  return PUBLIC_COLOR;
}

// 배경색 위에 읽히는 글자색 (밝으면 어둡게)
export function readableText(hex: string): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0a0d18' : '#ffffff';
}
