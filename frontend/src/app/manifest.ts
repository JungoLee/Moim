// 빌드 시 /manifest.webmanifest 로 생성된다 — 홈 화면 추가·PWA 기본 정보
import type { MetadataRoute } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import { SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/seo';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} — ${SITE_TAGLINE}`,
    short_name: BRAND_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#0f1424',
    theme_color: '#0f1424',
    lang: 'ko',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
