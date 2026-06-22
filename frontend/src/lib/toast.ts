// 아주 가벼운 전역 토스트 (모듈 pub/sub). Toaster 컴포넌트가 구독해서 렌더.
export type ToastType = 'info' | 'success' | 'error';
export type ToastItem = { id: number; msg: string; type: ToastType };

let items: ToastItem[] = [];
let seq = 1;
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l(items);
}

export function subscribe(l: (items: ToastItem[]) => void): () => void {
  listeners.add(l);
  l(items);
  return () => {
    listeners.delete(l);
  };
}

export function toast(msg: string, type: ToastType = 'info'): void {
  const id = seq++;
  items = [...items, { id, msg, type }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 2600);
}
