import { copyToClipboard } from '@/lib/clipboard';

type ShareResult = 'shared' | 'cancelled' | 'copied';

/**
 * 시스템 공유창을 쓸 수 있는 기기인가 — 휴대폰·태블릿(터치 전용 포인터)만 true.
 * PC 의 Chrome/Edge 도 navigator.share 가 있으므로 기능 감지만으론 부족해 포인터 종류도 본다.
 * window/navigator 는 호출 시점에만 건드린다(SSR·정적 렌더 안전) — 첫 렌더에서 쓰지 말고 마운트 뒤에 호출.
 */
export function canNativeShare(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
}

/** 모바일이면 시스템 공유창, 아니면(또는 공유 실패 시) 링크 복사 */
export async function shareOrCopy({ url, title, text }: { url: string; title?: string; text?: string }): Promise<ShareResult> {
  if (canNativeShare()) {
    try {
      await navigator.share({ url, title, text });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      /* 공유 실패 → 아래 복사 폴백 */
    }
  }
  await copyToClipboard(url);
  return 'copied';
}
