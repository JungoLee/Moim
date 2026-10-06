import { useEffect, useRef } from 'react';

// 열려 있는 층 — ESC 는 맨 위(가장 나중에 열린) 하나만 받는다.
// 층마다 document 에 따로 달면 겹쳐 열린 창(계정 서랍 위 약관·업데이트 창, 열린 창 위 확인창)이
// ESC 한 번에 다 닫힌다.
const layers: object[] = [];

/**
 * ESC 로 닫기 — 모달·계정 서랍·확인창·가이드 공용.
 * active 가 false 인 동안은 층에 올라가지 않는다(확인창·가이드처럼 늘 마운트돼 있다가 열릴 때만 받는 경우).
 * onClose 는 ref 로 읽는다: 바뀔 때마다 다시 등록하면 층 순서가 뒤바뀐다.
 */
export function useEscClose(onClose: () => void, active = true) {
  const handler = useRef(onClose);
  handler.current = onClose;

  useEffect(() => {
    if (!active) return;
    const me = {};
    layers.push(me);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && layers[layers.length - 1] === me) handler.current();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      layers.splice(layers.indexOf(me), 1);
    };
  }, [active]);
}
