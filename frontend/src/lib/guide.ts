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
    { target: g('home-tiles'), title: '빠른 이동', body: '자주 쓰는 기능을 한 번에 여는 타일이에요. 타일에 마우스를 올리면 짧은 설명이 떠요. 반짝이는 [모임]이 함께 되는 날을 찾아주는 핵심 기능!' },
    { target: g('home-upcoming'), title: '다가오는 일정', body: '7일 안의 내 일정이 D-day 배지와 함께 정렬돼요. 오른쪽 [캘린더 →]를 누르면 전체 캘린더로 이동해요. 받은 친구·시간 요청이 있으면 이 위에 알림 배너도 떠요.' },
    { target: g('home-leave'), title: '추천 연차', body: '연차 계산기에 잔여 연차를 저장해두면, 다가오는 최적 연차 조합 3개를 홈에서 미리 보여줘요. 자세한 계획은 [연차 계산 →]에서.' },
    { target: g('home-rooms'), title: '내 모임', body: '참여 중인 모임 목록이에요. 이름을 누르면 바로 방으로 입장해요. 방 안에서 각자 가능한 날을 표시하면 모두 되는 날을 찾아줘요.' },
  ],
  '/dashboard': [
    { target: g('cal'), title: '일정 만들기 — 클릭 & 드래그', body: '하루짜리는 빈 날짜를 클릭, 여러 날은 시작일부터 끝일까지 드래그해서 끌어 선택하세요. 놓는 순간 일정 입력 창이 떠요. 이미 만든 일정을 클릭하면 수정·삭제할 수 있어요.' },
    { target: g('cal-new'), title: '새 일정 버튼', body: '드래그 대신 버튼으로도 만들 수 있어요(오늘 날짜로 열림). 일정마다 종일/시간, 위치, 메모와 함께 공유(친구 모두에게 상세) 또는 비공개(선택한 그룹만 상세, 그 외엔 [바쁨])를 정해요.' },
    { target: g('cal-legend'), title: '색상 범례', body: '초록=공유, 주황=비공개, 나머지는 그룹 색이에요. 그룹 이름을 클릭하면 팔레트가 떠서 색을 바로 바꿀 수 있어요. 보라 점선은 내가 보낸 대기 중인 시간 요청.' },
  ],
  '/friends': [
    { target: FAB, title: '친구 추가', body: '우하단 + 버튼 → 👤 친구 추가에서 이메일로 요청을 보내세요. 상대가 수락하면 친구가 되고, 서로의 캘린더를 볼 수 있어요.' },
    { target: g('friends-requests'), title: '받은 요청', body: '나에게 온 친구 요청이에요. 수락/거절을 고르면 바로 반영돼요.' },
    { target: g('friends-list'), title: '내 친구', body: '[캘린더 보기]로 친구의 일정을 확인하세요 — 공유 일정은 상세히, 비공개 일정은 [바쁨]으로만 보여요. [그룹에 추가]로 비공개 일정을 공유할 그룹에 넣을 수 있어요.' },
  ],
  '/requests': [
    { target: FAB, title: '시간 요청 보내기', body: '+ 버튼 → ＋ 시간 요청 보내기. 친구를 고르고 날짜·시간(또는 종일)·제목·메시지를 적어 [이때 시간 내주세요]를 보내요.' },
    { target: g('req-received'), title: '받은 요청', body: '친구가 나에게 보낸 요청이에요. 수락하면 나와 상대 양쪽 캘린더에 일정이 자동으로 등록돼요.' },
    { target: g('req-sent'), title: '보낸 요청', body: '내가 보낸 요청의 수락/거절 상태를 확인하고, 아직 대기 중이면 취소할 수 있어요.' },
  ],
  '/tiers': [
    { target: FAB, title: '그룹 만들기 · 가입', body: '+ 버튼에서 새 그룹을 만들거나(이름·색상 지정), 친구에게 받은 초대 코드로 가입해요.' },
    { target: g('tiers-list'), title: '내 그룹', body: '비공개 일정은 여기서 고른 그룹의 멤버만 자세히 볼 수 있어요. [멤버] 아코디언을 펼쳐 이메일로 멤버를 추가하고, ⚙ 설정에서 초대 코드 복사·색상 변경·그룹 삭제를 해요.' },
  ],
  '/rooms': [
    { target: FAB, title: '모임 만들기 · 입장', body: '+ 버튼에서 모임을 만들거나 초대 코드로 입장해요. 방에 들어가면 URL·코드 공유로 친구를 초대할 수 있어요.' },
    { target: g('rooms-list'), title: '내 모임', body: '모임을 누르면 방으로 들어가요. 방 안에서 각자 가능한 날짜를 표시하면 모두 되는 날을 자동으로 찾아줘요. 방 안에서도 + 버튼 → 📖 사용 가이드로 자세한 사용법을 볼 수 있어요.' },
  ],
  // 모임 방 내부 (/rooms/:id — guideForPath 에서 패턴 매칭)
  '/rooms/:id': [
    { target: g('room-head'), title: '멤버 · 설정', body: '함께하는 멤버들이에요. 멤버 칩을 누르면 프로필이 떠서 캘린더 보기·친구/시간 요청을 보낼 수 있어요. 방장은 ⚙ 설정에서 방 이름 변경·초대 코드 재발급·URL 가입 허용·멤버 강퇴·삭제를 해요.' },
    { target: g('room-modes'), title: '표시 모드 고르기', body: '먼저 무엇을 표시할지 골라요 — 되는 날 / 안 되는 날 / 시간 이후(예: 19:00부터 가능, 시각 선택). [리셋]은 내 표시 전체 해제, [새로고침]은 친구들 표시 갱신이에요.' },
    { target: g('room-cal'), title: '날짜 표시 — 클릭 & 드래그', body: '하루는 클릭, 연속한 여러 날은 드래그해서 끌어 한 번에 표시해요. 각 칸에 내 표시와 [가능 N/멤버수] 집계가 보이고, 전원이 가능한 날은 초록으로 칠해져요.' },
    { target: g('room-result'), title: '모두 되는 날', body: '전원이 종일 가능한 날과, 시간을 조율하면 가능한 날(가장 늦은 시각 기준)을 자동으로 모아줘요. 여기서 모임 날짜를 정하면 끝!' },
    { target: FAB, title: '채팅 · 공유', body: '+ 버튼에 이 방 전용 메뉴가 있어요 — 💬 채팅으로 멤버들과 조율하고(안 읽은 수 배지), 📤 공유로 초대 URL이나 코드를 복사해 친구를 데려오세요.' },
  ],
  '/tools/leave': [
    { target: g('leave-form'), title: '조건 입력', body: '잔여 연차·시작일·연차 갱신일·한 번에 몰 수 있는 최대 연속 연차를 넣고, 스타일(짧게 여러 번 / 균형 / 길게 몰아서)을 골라요. 로그인 상태면 자동 저장되고 갱신일이 지나면 다음 해로 이월돼요.' },
    { target: g('leave-calc'), title: '계획 만들기', body: '버튼을 누르면 주말·공휴일(대체공휴일 포함)을 엮어 최소 연차로 최대 연휴를 만드는 조합을 계산해요.' },
    { target: g('leave-result'), title: '추천 결과 읽는 법', body: '달력의 파란 블록이 실제로 쓰는 연차일이에요. 효율(Nx)은 연차 1일당 만들어지는 휴무 일수 — 높을수록 가성비가 좋아요. 🎌 표시는 공휴일이 낀 구간이에요.' },
  ],
};

export function guideForPath(pathname: string): GuideStep[] | null {
  if (GUIDES[pathname]) return GUIDES[pathname];
  // 동적 라우트 — 모임 방 내부
  if (/^\/rooms\/[a-zA-Z0-9]+$/.test(pathname)) return GUIDES['/rooms/:id'];
  return null;
}
