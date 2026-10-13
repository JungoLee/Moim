import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';
import styles from './Shell.module.scss';

type Props = {
  href?: string;
  /** 아이콘 크기(px) */
  size?: number;
};

/** 로고 — app/icon.svg(그대로) + 'MOIM' 글자(Black Ops One). 로고 파일은 고치지 않는다. */
export default function BrandMark({ href = '/home', size = 30 }: Props) {
  return (
    <Link href={href} className={styles.brand} aria-label={`${BRAND_NAME} 홈`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={size} height={size} className={styles.brandIcon} />
      <span className={styles.brandWord}>{BRAND_NAME.toUpperCase()}</span>
    </Link>
  );
}
