'use client';

import Modal from '@/components/Modal';
import { RELEASES, type ReleaseKind } from '@/release/releases';

const KIND_LABEL: Record<ReleaseKind, string> = {
  feature: '새 기능',
  improve: '개선',
  fix: '고침',
};

const KIND_BG: Record<ReleaseKind, string> = {
  feature: 'rgba(88, 140, 255, 0.18)',
  improve: 'rgba(72, 187, 120, 0.18)',
  fix: 'rgba(128, 128, 128, 0.2)',
};

/** 업데이트 내역 — 약관·개인정보 처리방침과 같은 자리(계정 드로어 하단)에서 연다. */
export default function ReleaseModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} maxWidth={640}>
      <div className="app-row">
        <h3 style={{ margin: 0 }}>업데이트 내역</h3>
        <span className="app-spacer" />
        <button className="app-btn app-btn--ghost" onClick={onClose}>
          닫기
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
        {RELEASES.map((r) => (
          <section key={r.date}>
            <div
              className="app-row"
              style={{ gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--color-border, rgba(128,128,128,.25))' }}
            >
              <span className="app-muted" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{r.date}</span>
              {r.title && <strong style={{ fontSize: '0.95rem' }}>{r.title}</strong>}
            </div>
            <ul style={{ listStyle: 'none', margin: '0.6rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {r.items.map((it, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  <span
                    style={{
                      flexShrink: 0,
                      minWidth: '3rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '99px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      background: KIND_BG[it.kind],
                    }}
                  >
                    {KIND_LABEL[it.kind]}
                  </span>
                  <span>{it.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
