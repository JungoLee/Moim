import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.scss';
import { BRAND_NAME } from '@/lib/brand';
import { ADSENSE_CLIENT } from '@/lib/adsense';
import Toaster from '@/components/Toaster';
import ConfirmHost from '@/components/ConfirmHost';

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: '친구들과 스케줄을 공유하고 함께 비는 시간을 찾는 캘린더',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 본문 한글 폰트 (Gilo와 동일: Pretendard) — globals.scss 의 body font-family 1순위 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/static/pretendard-dynamic-subset.min.css"
        />
        {/* 브랜드 로고 아이덴티티 폰트 (Gilo와 동일: Black Ops One) */}
        <link href="https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* 구글 애드센스 — 게시자 ID 설정 시에만 로드 (Auto ads 는 대시보드에서 활성화) */}
        {ADSENSE_CLIENT && (
          <Script
            id="adsbygoogle-init"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        {children}
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}
