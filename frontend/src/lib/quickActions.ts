// 페이지가 등록하는 컨텍스트 퀵액션 (모듈 pub/sub). QuickActions(FAB)가 구독해서 렌더.
// toast/confirm 과 동일한 패턴 — 서버 레이아웃에 provider 를 두지 않아도 된다.
export type QuickAction = {
  id: string;
  label: string; // 예: '＋ 공개 그룹 만들기'
  onSelect: () => void; // 보통 페이지의 모달을 연다
};

let actions: QuickAction[] = [];
const listeners = new Set<(a: QuickAction[]) => void>();

function emit() {
  for (const l of listeners) l(actions);
}

export function subscribeQuickActions(l: (a: QuickAction[]) => void): () => void {
  listeners.add(l);
  l(actions);
  return () => {
    listeners.delete(l);
  };
}

// 현재 페이지의 퀵액션을 설정. 반환된 정리 함수를 언마운트 시 호출하면(내가 설정한 게 그대로면) 비운다.
export function setQuickActions(next: QuickAction[]): () => void {
  actions = next;
  emit();
  return () => {
    if (actions === next) {
      actions = [];
      emit();
    }
  };
}
