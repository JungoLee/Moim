import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.scss';
import { BRAND_NAME } from '@/lib/brand';
import { SITE_URL, SITE_TAGLINE, SITE_DESCRIPTION, SITE_KEYWORDS } from '@/lib/seo';
import { ADSENSE_CLIENT } from '@/lib/adsense';
import Toaster from '@/components/Toaster';
import ConfirmHost from '@/components/ConfirmHost';
import GuideHost from '@/components/GuideHost';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 하위 페이지는 title 만 주면 "제목 | 브랜드" 로 완성된다
  title: {
    default: `${BRAND_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: BRAND_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    locale: 'ko_KR',
    url: SITE_URL,
    title: `${BRAND_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0f1424',
  colorScheme: 'dark',
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
        <GuideHost />
      </body>
    </html>
  );
}
