import { useEffect, type RefObject } from 'react';

/**
 * 팝업이 열려 있을 때 ref 바깥을 누르면 닫는다 — 드롭다운·달력·색 팔레트·빠른 메뉴 공용.
 * 화면을 덮는 막을 깔지 않으므로 바깥 클릭은 그대로 통과한다.
 */
export function useOutsideClose(ref: RefObject<HTMLElement>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
    // close 는 화면의 setState 를 감싼 함수 — 열림 상태가 바뀔 때만 다시 건다(각 화면의 원래 의존성 [open] 과 같다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
