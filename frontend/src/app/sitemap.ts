// 빌드 시 /sitemap.xml 로 생성된다 (정적 export 호환)
// 로그인이 필요한 화면은 넣지 않는다 — 공개 페이지만 색인 대상.
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/tools/leave`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
