/**
 * 릴리즈 노트 — 사용자에게 보여줄 업데이트 내역.
 *
 * **여기가 단일 출처다.** 배포 직전 이 배열 맨 앞에 한 항목을 추가한다(최신이 위).
 * DB 가 아니라 소스에 두는 이유: 배포 산출물과 버전이 함께 고정돼야
 * "지금 보고 있는 화면의 릴리즈 노트" 가 맞다. DB 면 프론트 배포와 어긋날 수 있다.
 * (정적 export 라 더욱 — 빌드 결과물에 같이 실려야 한다.)
 *
 * 작성 규칙(사용자가 읽는 글이다 — 개발 로그가 아니다):
 *  - 체감하는 변화만. 리팩토링·문서 정리·내부 구조 변경은 넣지 않는다.
 *  - 내부 용어·파일명·함수명 금지.
 *    (X) "AvailabilityCalendar 리렌더 최적화"  (O) "빈 시간 찾기가 빨라졌어요"
 *  - 한 항목은 한 줄. kind: feature(새 기능)·improve(개선)·fix(고침)
 */
export type ReleaseKind = 'feature' | 'improve' | 'fix';

export interface ReleaseItem {
  kind: ReleaseKind;
  text: string;
}

export interface Release {
  /** YYYY-MM-DD */
  date: string;
  title?: string;
  items: ReleaseItem[];
}

export const RELEASES: Release[] = [
  {
    date: '2026-09-15',
    title: '업데이트 내역 공개',
    items: [{ kind: 'feature', text: '무엇이 바뀌었는지 이 화면에서 확인할 수 있습니다.' }],
  },
];
