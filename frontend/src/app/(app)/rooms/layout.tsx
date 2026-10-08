import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/seo';

// 모임 목록·방 상세(?id=) 모두 개인 데이터라 색인하지 않는다
export const metadata: Metadata = { title: '모임', ...NOINDEX };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
