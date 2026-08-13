// 빌드 시 /robots.txt 로 생성된다 (정적 export 호환)
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 로그인 뒤 화면 = 크롤러에겐 빈 껍데기. 크롤 예산을 공개 페이지에 몰아준다.
      disallow: ['/api/', '/admin', '/home', '/dashboard', '/friends', '/tiers', '/rooms', '/requests', '/u', '/auth/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
