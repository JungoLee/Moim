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
  {
    date: '2026-08-21',
    title: '로그인 정돈',
    items: [
      { kind: 'feature', text: '인증코드를 영문·숫자 6자리로 바꾸고 입력칸을 6칸으로 통일했습니다.' },
      { kind: 'fix', text: '휴대폰에서 인증코드 붙여넣기가 안 되던 문제를 고쳤습니다.' },
      { kind: 'fix', text: '인증코드 칸의 안내 문구가 이상하게 벌어지던 문제를 고쳤습니다.' },
    ],
  },
  {
    date: '2026-08-18',
    title: '메일이 잘 도착하게',
    items: [
      { kind: 'improve', text: '인증 메일 발송 방식을 바꿔 도착률을 높였습니다.' },
    ],
  },
  {
    date: '2026-07-08',
    title: '일정 정리',
    items: [
      { kind: 'improve', text: '상대가 지운 시간 요청을 누르면 안내가 뜨고, 내 일정에서도 같이 지울지 물어봅니다.' },
    ],
  },
];
