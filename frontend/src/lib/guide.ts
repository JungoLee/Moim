// 페이지별 사용 가이드(스포트라이트 투어) — toast/confirm/quickActions 와 동일한 모듈 pub/sub 패턴.
// 대상 요소는 각 페이지 JSX 의 data-guide 속성(또는 전역 클래스)으로 지정하고,
// GuideHost 가 시작 시점에 화면에 존재하는 타겟만 걸러 스텝을 진행한다(조건부 섹션 자동 스킵).
export type GuideStep = {
  target: string; // CSS 선택자 — 스포트라이트로 강조할 요소
  title: string;
  body: string;
};

let current: GuideStep[] | null = null;
const listeners = new Set<(s: GuideStep[] | null) => void>();

function emit() {
  for (const l of listeners) l(current);
}

export function subscribeGuide(l: (s: GuideStep[] | null) => void): () => void {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}

export function startGuide(steps: GuideStep[]): void {
  current = steps;
  emit();
}

export function stopGuide(): void {
  if (!current) return;
  current = null;
  emit();
}

const g = (name: string) => `[data-guide="${name}"]`;
const FAB = '.app-fab'; // 우하단 플로팅 + 버튼 (전 페이지 공통)

// 라우트별 가이드 정의 — QuickActions(FAB)의 '사용 가이드' 메뉴가 현재 경로로 조회해 시작
const GUIDES: Record<string, GuideStep[]> = {
  '/home': [
    { target: g('home-tiles'), title: '빠른 이동', body: '자주 쓰는 기능을 한 번에 여는 타일이에요. 반짝이는 "모임"이 함께 되는 날을 찾아주는 핵심 기능!' },
    { target: g('home-upcoming'), title: '다가오는 일정', body: '7일 안의 내 일정을 D-day 와 함께 보여줘요. 오른쪽 "캘린더 →" 를 누르면 전체 캘린더로 이동해요.' },
    { target: g('home-leave'), title: '추천 연차', body: '연차 계산기에 설정을 저장해두면, 다가오는 최적 연차 조합을 홈에서 바로 보여줘요.' },
    { target: g('home-rooms'), title: '내 모임', body: '참여 중인 모임 목록이에요. 눌러서 바로 입장할 수 있어요.' },
  ],
  '/dashboard': [
    { target: g('cal'), title: '내 캘린더', body: '빈 날짜를 클릭하거나 드래그해서 기간을 선택하면 새 일정을 만들어요. 만든 일정을 클릭하면 수정·삭제할 수 있어요.' },
    { target: g('cal-new'), title: '새 일정 버튼', body: '오늘 날짜로 바로 일정을 만들어요. 일정마다 공유(친구 모두에게 상세) / 비공개(선택한 그룹만 상세, 그 외엔 "바쁨")를 정할 수 있어요.' },
    { target: g('cal-legend'), title: '색상 범례', body: '초록=공개, 주황=비공개, 나머지는 그룹 색이에요. 그룹 이름을 클릭하면 색을 바꿀 수 있어요.' },
  ],
  '/friends': [
    { target: FAB, title: '친구 추가', body: '우하단 + 버튼 → 👤 친구 추가에서 이메일로 요청을 보내세요. 상대가 수락하면 친구가 돼요.' },
    { target: g('friends-requests'), title: '받은 요청', body: '나에게 온 친구 요청이에요. 수락하면 서로의 캘린더를 볼 수 있어요.' },
    { target: g('friends-list'), title: '내 친구', body: '친구의 캘린더 보기, 그룹에 추가를 할 수 있어요. 친구의 비공개 일정은 "바쁨"으로만 보여요.' },
  ],
  '/requests': [
    { target: FAB, title: '시간 요청 보내기', body: '+ 버튼 → "＋ 시간 요청 보내기". 친구·날짜·시간을 골라 "이때 시간 내주세요"를 보내요.' },
    { target: g('req-received'), title: '받은 요청', body: '수락하면 나와 상대 양쪽 캘린더에 일정이 자동으로 등록돼요.' },
    { target: g('req-sent'), title: '보낸 요청', body: '보낸 요청의 상태를 확인하고, 대기 중이면 취소할 수 있어요.' },
  ],
  '/tiers': [
    { target: FAB, title: '그룹 만들기 · 가입', body: '+ 버튼에서 새 그룹을 만들거나, 받은 초대 코드로 가입해요.' },
    { target: g('tiers-list'), title: '내 그룹', body: '비공개 일정은 여기서 고른 그룹 멤버만 자세히 볼 수 있어요. ⚙ 설정에서 초대 코드 복사·색상 변경·삭제, "멤버" 아코디언 아래에서 이메일로 멤버 추가.' },
  ],
  '/rooms': [
    { target: FAB, title: '모임 만들기 · 입장', body: '+ 버튼에서 모임을 만들거나 초대 코드로 입장해요. 모임 URL 공유로도 초대할 수 있어요.' },
    { target: g('rooms-list'), title: '내 모임', body: '모임에 들어가 각자 가능한 날짜를 표시하면 모두 되는 날을 자동으로 찾아줘요. 플로팅 채팅으로 조율까지!' },
  ],
  '/tools/leave': [
    { target: g('leave-form'), title: '조건 입력', body: '잔여 연차·시작일·갱신일·최대 연속 연차와 스타일을 설정해요. 로그인 상태면 자동 저장돼요.' },
    { target: g('leave-calc'), title: '계획 만들기', body: '버튼을 누르면 주말·공휴일을 엮어 최소 연차로 최대 연휴를 만드는 조합을 추천해요.' },
    { target: g('leave-result'), title: '추천 결과', body: '달력과 목록으로 추천 연차를 보여줘요. 효율(Nx)이 높을수록 적은 연차로 긴 휴무를 만든 거예요.' },
  ],
};

export function guideForPath(pathname: string): GuideStep[] | null {
  return GUIDES[pathname] || null;
}
