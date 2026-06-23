// 전역 커스텀 확인 다이얼로그 (네이티브 confirm 대체). ConfirmHost 가 구독해서 렌더.
export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};
export type ConfirmState = ConfirmOptions & { id: number };

type Pending = ConfirmState & { resolve: (ok: boolean) => void };

let current: Pending | null = null;
let seq = 1;
const listeners = new Set<(c: ConfirmState | null) => void>();

function emit() {
  for (const l of listeners) l(current);
}

export function subscribe(l: (c: ConfirmState | null) => void): () => void {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}

/** 커스텀 확인창. 사용자가 확인=true, 취소=false 로 resolve 되는 Promise 반환. */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise((resolve) => {
    // 이미 떠있는 확인창이 있으면 취소 처리
    if (current) current.resolve(false);
    current = { id: seq++, resolve, ...o };
    emit();
  });
}

export function resolveConfirm(ok: boolean): void {
  if (!current) return;
  current.resolve(ok);
  current = null;
  emit();
}
