'use client';

import { Wheel, ShadeSlider, hsvaToHex, hexToHsva } from '@uiw/react-color';

type Props = {
  /** 현재 색 (#rrggbb) */
  value: string;
  /** 색이 바뀔 때마다 #rrggbb 로 알림 (드래그 중 연속 호출 — 커밋은 호출부에서) */
  onChange: (hex: string) => void;
};

/** 원판형 색상 휠 + 밝기 슬라이더. 그룹 색 커스텀 선택용. */
export default function ColorWheel({ value, onChange }: Props) {
  const hsva = hexToHsva(value || '#7c8cff');
  return (
    <div className="app-wheel">
      <Wheel
        color={hsva}
        width={168}
        height={168}
        onChange={(c) => onChange(hsvaToHex({ ...hsva, ...c.hsva }))}
      />
      <ShadeSlider
        hsva={hsva}
        style={{ width: 168, marginTop: 12 }}
        onChange={(s) => onChange(hsvaToHex({ ...hsva, ...s }))}
      />
    </div>
  );
}
