// SEO 공통 상수 — 사이트 주소·설명·키워드의 단일 출처.
// 브랜드 노출 문구는 brand.ts 의 BRAND_NAME 을 조합해 만든다(브랜드 비종속 원칙).
import { BRAND_NAME } from './brand';

/** 운영 도메인. 절대 URL(canonical·OG·sitemap)에 쓰인다. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://moim.opnae.com';

/** 검색결과 제목에 붙는 한 줄 소개 */
export const SITE_TAGLINE = '친구와 약속 잡기, 공통 빈 시간 찾기';

export const SITE_DESCRIPTION =
  '친구들과 스케줄을 공유하고 모두 되는 날을 자동으로 찾아주는 무료 소셜 캘린더. ' +
  '일정별 공개/비공개 설정, 모임 날짜 투표, 연차 계산기까지 로그인 한 번으로 사용하세요.';

export const SITE_KEYWORDS = [
  '약속 잡기',
  '모임 날짜 정하기',
  '일정 공유',
  '공통 빈 시간',
  '스케줄 조율',
  '친구 캘린더',
  '모임 일정 조율',
  '연차 계산기',
  '징검다리 연휴',
  BRAND_NAME,
];

/** 소셜 공유 카드 공통 필드 */
export function socialCard(title: string, description: string, path = '/') {
  const url = `${SITE_URL}${path}`;
  return {
    openGraph: {
      type: 'website' as const,
      siteName: BRAND_NAME,
      locale: 'ko_KR',
      title,
      description,
      url,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

/** 로그인 뒤에 있는 화면 — 색인하지 않는다(빈 껍데기가 색인되면 품질 점수만 깎인다) */
export const NOINDEX = {
  robots: { index: false, follow: false, nocache: true },
} as const;
