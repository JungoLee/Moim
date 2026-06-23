'use client';

import { useState } from 'react';
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

/** 프리셋 스와치 + 커스텀 휠(토글) 공용 팔레트. 그룹 색 선택 어디서나 동일하게 사용. */
export default function ColorPalette({ value, onChange, immediate = false }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(value);

  function toggle() {
    setPreview(value);
    setOpen((v) => !v);
  }

  return (
    <div className="app-palette">
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
      {open &&
        (immediate ? (
          <div className="app-palette-wheel">
            <ColorWheel value={value} onChange={onChange} />
          </div>
        ) : (
          <div className="app-palette-wheel">
            <ColorWheel value={preview} onChange={setPreview} />
            <div className="app-row" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                className="app-btn"
                onClick={() => {
                  onChange(preview);
                  setOpen(false);
                }}
              >
                이 색으로 적용
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
