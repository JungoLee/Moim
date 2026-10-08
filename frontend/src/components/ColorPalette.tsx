'use client';

import { useRef, useState } from 'react';
import ColorWheel from '@/components/ColorWheel';
import Icon from '@/components/Icon';
import { useOutsideClose } from '@/lib/useOutsideClose';
import { TIER_PALETTE } from '@/lib/colors';
import styles from './ColorPalette.module.scss';

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

/** 프리셋 색 + 직접 고르기(휠 팝업). 그룹 색 공용. 색 칸 바탕은 데이터 값이라 인라인. */
export default function ColorPalette({ value, onChange, immediate = false }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClose(ref, open, () => setOpen(false));

  function toggle() {
    setPreview(value);
    setOpen((v) => !v);
  }

  const current = immediate ? value : preview;

  return (
    <div className={styles.palette} ref={ref}>
      <div className={styles.swatches} role="group" aria-label="색 고르기">
        {TIER_PALETTE.map((c) => (
          <button
            type="button"
            key={c}
            className={styles.swatch}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={`색 ${c}`}
            aria-pressed={c.toLowerCase() === value.toLowerCase()}
          />
        ))}
        <button type="button" className={styles.custom} onClick={toggle} aria-expanded={open} aria-label="직접 고르기" title="직접 고르기">
          <Icon name="plus" size={16} />
        </button>
      </div>
      {open && (
        <div className={styles.box} role="dialog" aria-label="색 직접 고르기">
          <div className={styles.preview}>
            <span className={styles.previewSw} style={{ background: current }} />
            <span className="ui-num">{current.toUpperCase()}</span>
          </div>
          <ColorWheel value={current} onChange={immediate ? onChange : setPreview} />
          {!immediate && (
            <button
              type="button"
              className="ui-btn ui-btn--primary ui-btn--block"
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
