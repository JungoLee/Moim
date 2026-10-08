'use client';

import HomeBoard from '@/components/home/HomeBoard';
import HomeTable from '@/components/home/HomeTable';
import { useHomeData } from '@/components/home/useHomeData';
import { useTheme } from '@/lib/theme';

// 홈 — 데이터·동작은 useHomeData 한 곳, 보기만 테마로 갈린다(docs/design-system.md 0장 '코드 원칙').
// 테마 분기는 이 파일의 이 한 곳뿐.
export default function Home() {
  const theme = useTheme();
  const data = useHomeData({ withFriends: theme === 'table' });
  return <div className="ui-page">{theme === 'table' ? <HomeTable data={data} /> : <HomeBoard data={data} />}</div>;
}
