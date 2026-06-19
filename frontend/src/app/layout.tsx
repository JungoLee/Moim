import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.scss';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: '친구들과 스케줄을 공유하고 함께 비는 시간을 찾는 캘린더',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
