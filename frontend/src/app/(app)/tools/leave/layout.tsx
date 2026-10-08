import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BRAND_NAME } from '@/lib/brand';
import { socialCard } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';

// 로그인 없이 쓰는 공개 도구 — 이 사이트에서 검색 유입이 가장 큰 페이지다.
const TITLE = '연차 계산기 — 최소 연차로 최장 연휴 만들기';
const DESCRIPTION =
  '남은 연차와 갱신일만 넣으면 주말·공휴일(대체공휴일 포함)을 엮어 가장 효율적인 연차 사용일을 추천합니다. ' +
  '2026~2031년 공휴일 내장, 징검다리 연휴 자동 계산, 로그인 없이 무료.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['연차 계산기', '징검다리 연휴', '연차 사용 계획', '황금연휴', '공휴일 계산기', '연차 효율'],
  ...socialCard(`${TITLE} | ${BRAND_NAME}`, DESCRIPTION, '/tools/leave'),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: `연차 계산기 | ${BRAND_NAME}`,
          description: DESCRIPTION,
          url: 'https://moim.opnae.com/tools/leave',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          inLanguage: 'ko-KR',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
          featureList: [
            '주말·공휴일을 엮는 브릿지(징검다리) 연휴 계산',
            '2026~2031년 공휴일 내장(음력·대체공휴일 자동 반영)',
            '연차 1일당 휴무 일수(효율) 표시',
            '연차 갱신일 기준 자동 이월',
          ],
        }}
      />
      {children}
    </>
  );
}
