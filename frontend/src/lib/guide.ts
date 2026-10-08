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

// 라우트별 가이드 — 화면 머리의 ? 버튼(PageHeader)이 현재 경로로 찾아 시작한다.
// 대상 이름은 docs/design-system.md 11장. 보드/표 한쪽에만 있는 대상은 그 테마에서만 보인다(없으면 건너뜀).
const GUIDES: Record<string, GuideStep[]> = {
  '/home': [
    { target: g('home-inbox'), title: '답할 것', body: '나에게 온 시간 요청과 친구 요청이에요. 여기서 바로 수락하거나 거절할 수 있어요.' },
    { target: g('home-week'), title: '이번 주', body: '오늘부터 7일 동안의 내 일정이에요. 공휴일 이름도 함께 보여요.' },
    { target: g('home-free'), title: '누가 언제 비나', body: '나와 친구들의 이번 주를 오전·오후·저녁으로 나눠 보여줘요. 친구 일정은 내용 없이 “바쁨”으로만 보이고, 맨 아래 줄은 다 같이 비는 때예요.' },
    { target: g('home-rooms'), title: '내 모임', body: '모임마다 몇 명이 날짜를 찍었는지, 후보 날짜가 있는지 보여줘요. 누르면 모임 방으로 가요.' },
    { target: g('home-leave'), title: '추천 연차', body: '연차 계산기에 남은 연차를 저장해 두면 가장 길게 쉴 수 있는 날을 미리 알려줘요.' },
  ],
  '/dashboard': [
    { target: g('cal'), title: '일정 만들기', body: '날짜를 누르거나 여러 날을 끌어서 고르면 일정 입력 창이 떠요. 만든 일정을 누르면 고치거나 지울 수 있어요.' },
    { target: g('cal-new'), title: '새 일정', body: '버튼으로도 만들 수 있어요. 일정마다 공개(친구 모두에게 자세히) 또는 비공개(고른 그룹만 자세히, 나머지는 “바쁨”)를 정해요.' },
    { target: g('cal-legend'), title: '색 보는 법', body: '공개·비공개·시간 요청·모임 확정 일정의 색이에요. 그룹 색을 누르면 바로 바꿀 수 있어요.' },
  ],
  '/friends': [
    { target: g('people-tabs'), title: '사람', body: '친구·그룹·시간 요청을 이 탭으로 오가요.' },
    { target: g('friends-add'), title: '친구 추가', body: '친구의 이메일로 요청을 보내요. 상대가 수락하면 서로의 캘린더를 볼 수 있어요.' },
    { target: g('friends-requests'), title: '받은 친구 요청', body: '나에게 온 친구 요청이에요. 수락하거나 거절해요.' },
    { target: g('friends-list'), title: '내 친구', body: '친구 캘린더를 보거나, 시간 요청을 보내거나, 그룹에 넣을 수 있어요.' },
  ],
  '/tiers': [
    { target: g('people-tabs'), title: '사람', body: '친구·그룹·시간 요청을 이 탭으로 오가요.' },
    { target: g('tiers-new'), title: '그룹 만들기', body: '그룹을 만들거나 받은 코드로 가입해요. 비공개 일정은 고른 그룹 멤버에게만 자세히 보여요.' },
    { target: g('tiers-list'), title: '내 그룹', body: '그룹 코드를 복사해 친구를 부르고, 설정에서 색·멤버를 바꾸거나 그룹을 지워요.' },
  ],
  '/requests': [
    { target: g('people-tabs'), title: '사람', body: '친구·그룹·시간 요청을 이 탭으로 오가요.' },
    { target: g('req-new'), title: '시간 요청 보내기', body: '친구를 고르고 날짜·시간을 정해 “이때 시간 내줄 수 있어?”를 보내요.' },
    { target: g('req-list'), title: '받은 요청 · 보낸 요청', body: '받은 요청을 수락하면 나와 상대 캘린더에 일정이 같이 생겨요. 보낸 요청은 대기 중일 때 취소할 수 있어요.' },
  ],
  '/rooms': [
    { target: g('rooms-new'), title: '새 모임', body: '모임을 만들고 링크나 코드로 친구를 불러요.' },
    { target: g('rooms-join'), title: '코드로 입장', body: '친구에게 받은 8자리 코드로 들어가요.' },
    { target: g('rooms-list'), title: '내 모임', body: '모임마다 찍은 사람 수와 후보 날짜가 보여요. 누르면 방으로 들어가요.' },
  ],
  // 모임 방 (/rooms/detail?id=…)
  '/rooms/:id': [
    { target: g('room-members'), title: '멤버', body: '함께하는 사람들이에요. 날짜를 찍은 사람에게는 체크가 붙어요. 이름을 누르면 프로필이 떠요.' },
    { target: g('room-modes'), title: '표시 방법', body: '되는 날 · 안 되는 날 · 저녁 이후(시각 고르기) 중 하나를 고른 뒤 날짜를 찍어요.' },
    { target: g('room-cal'), title: '날짜 찍기', body: '하루는 누르고, 여러 날은 끌어서 한 번에 찍어요. 다 같이 되는 날은 가장 진한 색으로 보여요.' },
    { target: g('room-cands'), title: '후보 날짜', body: '모두 되는 날을 자동으로 모아줘요. 방장이 [확정]을 누르면 멤버 모두의 캘린더에 일정이 들어가요.' },
    { target: g('room-chat'), title: '대화', body: '멤버들과 날짜를 조율해요. 새 메시지가 오면 숫자가 붙어요.' },
    { target: g('room-invite'), title: '초대', body: '링크나 코드를 복사해 친구를 불러요.' },
  ],
  '/tools/leave': [
    { target: g('leave-form'), title: '조건 넣기', body: '남은 연차·갱신일·최대 연속 연차를 넣고 방식을 골라요. 계산은 늘 오늘부터 시작해요. 로그인했다면 저장되고, 갱신일이 지나면 다음 해로 넘어가요.' },
    { target: g('leave-calc'), title: '계획 만들기', body: '주말·공휴일(대체공휴일 포함)을 엮어 연차를 가장 적게 쓰고 가장 길게 쉬는 조합을 찾아요.' },
    { target: g('leave-result'), title: '결과 보는 법', body: '배수(예: 4x)는 연차 하루로 쉬는 날 수예요. 높을수록 이득이에요.' },
  ],
};

export function guideForPath(pathname: string): GuideStep[] | null {
  // 모임 방 내부 — 목록(/rooms)보다 먼저 판정
  if (pathname === '/rooms/detail') return GUIDES['/rooms/:id'];
  if (GUIDES[pathname]) return GUIDES[pathname];
  return null;
}
