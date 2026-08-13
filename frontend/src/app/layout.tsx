import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { Black_Ops_One } from 'next/font/google';
import './globals.scss';

// 브랜드 로고 폰트 — 빌드 시 셀프호스팅되어 외부 요청·렌더 블로킹이 사라진다
const brandFont = Black_Ops_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brand',
});
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
    <html lang="ko" className={brandFont.variable}>
      <head>
        {/* 본문 한글 폰트(Pretendard) — 동적 서브셋이라 필요한 글자만 받는다.
            CDN 연결을 미리 열어 두면 첫 렌더까지의 왕복이 줄어든다. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/static/pretendard-dynamic-subset.min.css"
        />
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
