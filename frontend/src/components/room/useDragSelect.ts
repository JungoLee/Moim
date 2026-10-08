'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

// 달력·표 공용 '누르기 / 끌기' — 포인터 이벤트라 마우스·터치·펜이 같은 길을 탄다.
//  · 마우스·펜: 누르는 즉시 시작, 끌면 범위가 넓어진다.
//  · 터치: 짧게 누르면 한 칸(탭), 길게 누르면 끌기가 시작된다. 누른 채 먼저 움직이면(스크롤) 취소.
//    끌기가 시작되면 touchmove 를 막아 화면이 같이 밀리지 않게 한다.
//  · 키보드: 칸 버튼에서 Enter/Space → onClick(detail 0) 이 한 칸을 적용한다.
// 칸은 data-key 속성으로 찾는다. keys 는 화면에 놓인 순서(날짜순)여서 범위 = 두 키 사이 전부.

type Options = {
  /** 선택할 수 있는 칸의 키(날짜순) */
  keys: string[];
  /** 눌러도 되는 칸인지 (지난 날 등) */
  isDisabled: (key: string) => boolean;
  onApply: (keys: string[], isDrag: boolean) => void;
};

const HOLD_MS = 280;
const MOVE_SLOP = 10;

function keyOf(el: Element | null, root: HTMLElement | null): string | null {
  if (!el || !root || !root.contains(el)) return null;
  const hit = el.closest<HTMLElement>('[data-key]');
  return hit && root.contains(hit) ? hit.dataset.key || null : null;
}

export function useDragSelect(opts: Options) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const rootRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [range, setRange] = useState<{ a: string; b: string } | null>(null);

  // 끌기 중 화면이 밀리지 않게 — React 의 touchmove 는 passive 라 직접 단다
  const setRoot = useCallback((el: HTMLElement | null) => {
    rootRef.current = el;
  }, []);
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (draggingRef.current && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      cleanupRef.current?.();
    };
  }, []);

  const selected = useMemo(() => {
    if (!range) return null;
    const { keys, isDisabled } = optsRef.current;
    const i = keys.indexOf(range.a);
    const j = keys.indexOf(range.b);
    if (i < 0 || j < 0) return new Set<string>();
    const [lo, hi] = i <= j ? [i, j] : [j, i];
    return new Set(keys.slice(lo, hi + 1).filter((k) => !isDisabled(k)));
  }, [range]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const root = rootRef.current;
    const first = keyOf(e.target as Element, root);
    if (!first || optsRef.current.isDisabled(first)) return;
    cleanupRef.current?.();

    const isTouch = e.pointerType === 'touch';
    const startX = e.clientX;
    const startY = e.clientY;
    const anchor = first;
    let focus = first;
    let started = !isTouch;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (started) {
      draggingRef.current = true;
      setRange({ a: anchor, b: focus });
    } else {
      timer = setTimeout(() => {
        started = true;
        draggingRef.current = true;
        setRange({ a: anchor, b: focus });
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
      }, HOLD_MS);
    }

    const stop = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      draggingRef.current = false;
      cleanupRef.current = null;
      setRange(null);
    };
    function move(ev: PointerEvent) {
      if (!started) {
        // 길게 누르기 전에 움직였다 = 스크롤하려는 것
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_SLOP) stop();
        return;
      }
      const k = keyOf(document.elementFromPoint(ev.clientX, ev.clientY), rootRef.current);
      if (k && k !== focus && !optsRef.current.isDisabled(k)) {
        focus = k;
        setRange({ a: anchor, b: focus });
      }
    }
    function up() {
      const wasStarted = started;
      const { keys, isDisabled, onApply } = optsRef.current;
      stop();
      if (!wasStarted) {
        onApply([anchor], false); // 터치 탭
        return;
      }
      const i = keys.indexOf(anchor);
      const j = keys.indexOf(focus);
      if (i < 0 || j < 0) return;
      const [lo, hi] = i <= j ? [i, j] : [j, i];
      const picked = keys.slice(lo, hi + 1).filter((k) => !isDisabled(k));
      if (picked.length) onApply(picked, anchor !== focus);
    }
    function cancel() {
      stop();
    }
    cleanupRef.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }, []);

  /** 키보드(Enter/Space)로 누른 클릭만 한 칸 적용 — 포인터 클릭은 위에서 이미 처리했다 */
  const onClick = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (e.detail !== 0) return;
    const k = keyOf(e.target as Element, rootRef.current);
    if (k && !optsRef.current.isDisabled(k)) optsRef.current.onApply([k], false);
  }, []);

  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    // 터치 길게 누르기가 메뉴를 띄우지 않게
    if (draggingRef.current || (e.nativeEvent as PointerEvent).pointerType === 'touch') e.preventDefault();
  }, []);

  return {
    /** 칸들을 감싼 요소에 달 것 */
    bind: { ref: setRoot, onPointerDown, onClick, onContextMenu },
    /** 끌고 있는 동안 선택될 칸들 (끌기 아님 = null) */
    selected,
  };
}
