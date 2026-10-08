import type { ReactNode } from 'react';
import AppShell from '@/components/shell/AppShell';

// 로그인 뒤 화면 묶음 — 틀(메뉴)을 여기서 한 번만 그린다. 주소에는 (app) 이 붙지 않는다.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
