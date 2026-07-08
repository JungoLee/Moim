'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { subscribeGuide, stopGuide, type GuideStep } from '@/lib/guide';

const PAD = 8; // 스포트라이트가 대상보다 살짝 크게 (px)
const TIP_W = 340; // 설명 카드 폭 (px, CSS 와 동일)
const TIP_GAP = 14; // 스포트라이트 ↔ 설명 카드 간격 (px)
const EDGE = 12; // 화면 가장자리 최소 여백 (px)

type Rect = { top: number; left: number; width: number; height: number };

/** 사용 가이드(스포트라이트 투어) 호스트 — 루트 레이아웃에서 렌더. lib/guide 의 startGuide 로 시작. */
export default function GuideHost() {
  const pathname = usePathname();
  const [steps, setSteps] = useState<GuideStep[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // 설명 카드 위치 — 렌더 후 실제 높이를 재서 화면 안으로 클램프 (긴 카드가 하단 밖으로 나가 버튼을 못 누르는 문제 방지)
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  // 시작 시 화면에 실제로 존재하는 타겟만 남긴다 (빈 목록·조건부 섹션 자동 스킵)
  useEffect(
    () =>
      subscribeGuide((s) => {
        if (!s) {
          setSteps(null);
          return;
        }
        const found = s.filter((st) => document.querySelector(st.target));
        setSteps(found.length ? found : null);
        setIdx(0);
      }),
    []
  );

  // 페이지 이동 시 가이드 종료
  useEffect(() => {
    stopGuide();
  }, [pathname]);

  const step = steps?.[idx] ?? null;

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // 스텝 변경: 대상을 화면 중앙으로 즉시 스크롤 후 측정 (박스 이동 애니메이션은 CSS transition)
  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    document.querySelector(step.target)?.scrollIntoView({ block: 'center', behavior: 'auto' });
    measure();
  }, [step, measure]);

  // 리사이즈·스크롤 시 스포트라이트가 대상을 따라가도록 재측정
  useEffect(() => {
    if (!step) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, measure]);

  // ESC 로 닫기
  useEffect(() => {
    if (!steps) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') stopGuide();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps]);

  // 카드 위치 계산 — paint 전(useLayoutEffect)에 실제 높이 측정: 아래 → 위 → 그래도 안 되면 화면 안 클램프
  useLayoutEffect(() => {
    if (!rect) {
      setTipPos(null);
      return;
    }
    const h = tipRef.current?.offsetHeight ?? 0;
    const vh = window.innerHeight;
    let top = rect.top + rect.height + TIP_GAP; // 1순위: 스포트라이트 아래
    if (top + h + EDGE > vh) top = rect.top - TIP_GAP - h; // 2순위: 위
    top = Math.min(Math.max(EDGE, top), Math.max(EDGE, vh - h - EDGE)); // 최종: 항상 화면 안
    const left = Math.min(Math.max(rect.left, EDGE), Math.max(EDGE, window.innerWidth - TIP_W - EDGE));
    setTipPos({ top, left });
  }, [rect, idx]);

  if (!steps || !step || !rect) return null;

  const last = idx === steps.length - 1;
  const next = () => (last ? stopGuide() : setIdx((i) => i + 1));

  return (
    // 배경(어두운 영역) 클릭 = 다음 스텝. 카드 안 클릭은 전파 차단.
    <div className="app-guide" role="dialog" aria-label="사용 가이드" onClick={next}>
      <div
        className="app-guide-spot"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
      <div
        ref={tipRef}
        // 첫 렌더(위치 미계산)엔 숨긴 채 높이만 재고, 이후 스텝 이동은 transition 으로 미끄러짐
        className={tipPos ? 'app-guide-tip' : 'app-guide-tip app-guide-tip--measuring'}
        style={tipPos ?? { top: 0, left: EDGE }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="app-guide-count">
          {idx + 1} / {steps.length}
        </span>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="app-guide-actions">
          <button type="button" className="app-btn app-btn--ghost" onClick={() => stopGuide()}>
            건너뛰기
          </button>
          <span className="app-spacer" />
          {idx > 0 && (
            <button type="button" className="app-btn app-btn--ghost" onClick={() => setIdx((i) => i - 1)}>
              이전
            </button>
          )}
          <button type="button" className="app-btn" onClick={next}>
            {last ? '완료' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
