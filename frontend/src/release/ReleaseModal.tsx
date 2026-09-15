'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { RELEASES, type Release, type ReleaseKind } from '@/release/releases';
import styles from './ReleaseModal.module.scss';

const KIND_LABEL: Record<ReleaseKind, string> = {
  feature: '새 기능',
  improve: '개선',
  fix: '고침',
};

const KIND_CLASS: Record<ReleaseKind, string> = {
  feature: styles.kindFeature,
  improve: styles.kindImprove,
  fix: styles.kindFix,
};

/**
 * 업데이트 내역 — 목록에서 고른 뒤 상세를 본다(2단).
 * 한 화면에 전부 펼치면 릴리즈가 쌓일수록 무엇이 최신인지 읽기 어려워진다.
 */
export default function ReleaseModal({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<Release | null>(null);

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <div className="app-row">
        <h3 className="app-modal-title">
          {picked ? `v${picked.version}${picked.title ? ` · ${picked.title}` : ''}` : '업데이트 내역'}
        </h3>
        <span className="app-spacer" />
        <button className="app-btn app-btn--ghost" onClick={onClose}>
          닫기
        </button>
      </div>

      {picked ? (
        <>
          <button className={`app-btn app-btn--ghost ${styles.back}`} onClick={() => setPicked(null)}>
            ← 목록
          </button>
          <div className={styles.head}>
            <strong className={styles.version}>v{picked.version}</strong>
            <span className={`app-muted ${styles.date}`}>{picked.date}</span>
          </div>
          <ul className={styles.lines}>
            {picked.items.map((it, i) => (
              <li key={i} className={styles.line}>
                <span className={`${styles.kind} ${KIND_CLASS[it.kind]}`}>{KIND_LABEL[it.kind]}</span>
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className={styles.index}>
          {RELEASES.map((r) => (
            <li key={r.date}>
              <button className={styles.entry} onClick={() => setPicked(r)}>
                <span className={styles.tag}>v{r.version}</span>
                <span className={styles.entryBody}>
                  <strong className={styles.entryTitle}>{r.title ?? ''}</strong>
                  <span className={`app-muted ${styles.entryMeta}`}>{r.date}</span>
                </span>
                <span className={`app-muted ${styles.entryMeta}`}>{r.items.length}</span>
                <span className="app-muted" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
