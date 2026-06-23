'use client';

import { useEffect, useRef, useState } from 'react';
import ColorWheel from '@/components/ColorWheel';
import { TIER_PALETTE } from '@/lib/colors';

type Props = {
  /** 현재 색 (#rrggbb) */
  value: string;
  /** 프리셋 클릭 또는 휠 '적용' 시 호출 */
  onChange: (hex: string) => void;
  /**
   * true  = 휠 조작이 즉시 onChange (로컬 상태용, 예: 새 그룹 만들기)
   * false = 휠은 미리보기만, '이 색으로 적용' 버튼으로 1회 커밋 (서버 PATCH용)
   */
  immediate?: boolean;
};

/** 프리셋 스와치 + 커스텀 휠(🎨 버튼 아래 팝업 박스, 미리보기 포함) 공용 팔레트. */
export default function ColorPalette({ value, onChange, immediate = false }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggle() {
    setPreview(value);
    setOpen((v) => !v);
  }

  const current = immediate ? value : preview;

  return (
    <div className="app-palette" ref={ref}>
      <div className="app-swatches">
        {TIER_PALETTE.map((c) => (
          <button
            type="button"
            key={c}
            className={c === value ? 'app-swatch is-on' : 'app-swatch'}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={`색상 ${c}`}
            aria-pressed={c === value}
          />
        ))}
        <button
          type="button"
          className={open ? 'app-swatch-toggle is-on' : 'app-swatch-toggle'}
          onClick={toggle}
          aria-pressed={open}
          title="커스텀 색 선택"
        >
          🎨
        </button>
      </div>
      {open && (
        <div className="app-palette-box" role="dialog" aria-label="커스텀 색 선택">
          <div className="app-palette-preview">
            <span className="app-swatch-preview" style={{ background: current }} />
            <span className="app-palette-hex">{current.toUpperCase()}</span>
          </div>
          <ColorWheel value={current} onChange={immediate ? onChange : setPreview} />
          {!immediate && (
            <button
              type="button"
              className="app-btn"
              style={{ width: '100%' }}
              onClick={() => {
                onChange(preview);
                setOpen(false);
              }}
            >
              이 색으로 적용
            </button>
          )}
        </div>
      )}
    </div>
  );
}
