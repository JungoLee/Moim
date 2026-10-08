import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { Black_Ops_One } from 'next/font/google';
import '@/styles/tokens.scss';
import '@/styles/base.scss';
import '@/styles/components.scss';
import '@/styles/fullcalendar.scss';

// 브랜드 로고 폰트 — 빌드 시 셀프호스팅되어 외부 요청·렌더 블로킹이 사라진다
const brandFont = Black_Ops_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brand-next',
});
import { BRAND_NAME } from '@/lib/brand';
import { SITE_URL, SITE_TAGLINE, SITE_DESCRIPTION, SITE_KEYWORDS } from '@/lib/seo';
import { ADSENSE_CLIENT } from '@/lib/adsense';
import Toaster from '@/components/Toaster';
import ConfirmHost from '@/components/ConfirmHost';
import GuideHost from '@/components/GuideHost';
import { THEME_INIT_SCRIPT } from '@/lib/themeInit';

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
  themeColor: '#0b0f1c', // 테마를 바꾸면 lib/theme.ts 가 고친다
  viewportFit: 'cover', // 모바일 아래 탭이 홈 표시줄 위로 — safe-area 를 쓴다
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={brandFont.variable} data-theme="board" suppressHydrationWarning>
      <head>
        {/* 화면 테마(보드/표)를 그리기 전에 넣는다 — 깜빡임 방지 (docs/design-system.md 7장) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* 본문 글꼴 Pretendard — 버전 고정, 동적 서브셋(필요한 글자만 받는다) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
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
