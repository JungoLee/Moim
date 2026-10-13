'use client';

import Icon from '@/components/Icon';
import { DEFAULT_TIER_COLOR } from '@/lib/colors';
import type { Tier } from '@/lib/types';
import styles from './TierPicker.module.scss';

type Props = {
  tiers: Tier[];
  /** 이 사람이 이미 든 그룹은 '포함'으로 막는다 */
  userId: string;
  onAdd: (tierId: string) => void;
};

/** '그룹에 추가' 칩 목록 — 친구 목록·프로필 팝업 공용. 그룹 색 점은 데이터 값이라 인라인. */
export default function TierPicker({ tiers, userId, onAdd }: Props) {
  if (!tiers.length) return <p className="ui-help">아직 만든 그룹이 없어요. 사람 › 그룹에서 만들 수 있어요.</p>;
  return (
    <div className={styles.chips} role="group" aria-label="그룹에 추가">
      {tiers.map((t) => {
        const already = t.members?.some((m) => m._id === userId);
        return (
          <button
            key={t._id}
            type="button"
            className={styles.chip}
            onClick={() => onAdd(t._id)}
            disabled={already}
            aria-pressed={already}
            title={already ? '이미 든 그룹' : `${t.name} 그룹에 추가`}
          >
            <span className={styles.dot} style={{ background: t.color || DEFAULT_TIER_COLOR }} aria-hidden />
            {t.name}
            {already ? <Icon name="check" size={14} stroke={2.6} /> : <Icon name="plus" size={14} stroke={2.6} />}
          </button>
        );
      })}
    </div>
  );
}
