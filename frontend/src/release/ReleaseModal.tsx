'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { RELEASES, type Release, type ReleaseKind } from '@/release/releases';

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

const LINE = '1px solid var(--color-border, rgba(128,128,128,.25))';

/**
 * 업데이트 내역 — 목록에서 고른 뒤 상세를 본다(2단).
 * 한 화면에 전부 펼치면 릴리즈가 쌓일수록 무엇이 최신인지 읽기 어려워진다.
 */
export default function ReleaseModal({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<Release | null>(null);

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <div className="app-row">
        <h3 style={{ margin: 0 }}>
          {picked ? `${picked.date}${picked.title ? ` · ${picked.title}` : ''}` : '업데이트 내역'}
        </h3>
        <span className="app-spacer" />
        <button className="app-btn app-btn--ghost" onClick={onClose}>
          닫기
        </button>
      </div>

      {picked ? (
        <>
          <button
            className="app-btn app-btn--ghost"
            style={{ marginTop: '1rem' }}
            onClick={() => setPicked(null)}
          >
            ← 목록
          </button>
          <ul style={{ listStyle: 'none', margin: '1rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            {picked.items.map((it, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '.5rem', fontSize: '.95rem', lineHeight: 1.6 }}>
                <span
                  style={{
                    flexShrink: 0,
                    minWidth: '3rem',
                    padding: '.1rem .4rem',
                    borderRadius: '99px',
                    fontSize: '.7rem',
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
        </>
      ) : (
        <ul style={{ listStyle: 'none', margin: '1rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {RELEASES.map((r) => (
            <li key={r.date}>
              <button
                onClick={() => setPicked(r)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto',
                  alignItems: 'center',
                  gap: '.8rem',
                  width: '100%',
                  padding: '.9rem 1rem',
                  border: LINE,
                  borderRadius: '.6rem',
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span className="app-muted" style={{ fontSize: '.8rem', fontWeight: 700 }}>{r.date}</span>
                <strong style={{ fontSize: '.95rem' }}>{r.title ?? ''}</strong>
                <span className="app-muted" style={{ fontSize: '.75rem' }}>{r.items.length}</span>
                <span className="app-muted" aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
