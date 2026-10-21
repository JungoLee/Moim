'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import { displayName } from '@/lib/format';
import { roomStatus } from '@/lib/roomStatus';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import AccountDrawer from '@/components/AccountDrawer';
import BrandMark from './BrandMark';
import ThemeSwitch from './ThemeSwitch';
import { NAV, LEAVE_LINK, normPath } from './nav';
import { ShellProvider, useShell, inboxCount } from './ShellContext';
import styles from './Shell.module.scss';

// 로그아웃 상태로도 여는 화면 — 메뉴 대신 간단한 머리만
const PUBLIC_PATHS = ['/tools/leave'];

// 휴대폰에서 앱 위 머리(로고 줄)를 숨기는 화면 — 자기 머리(뒤로 · 이름 · 단추)가 있어 두 겹이 된다
const OWN_HEAD_PATHS = ['/rooms/detail'];

// 위 머리 접기 — 이만큼(머리 높이)은 늘 보이고, 이보다 작게 움직인 것은 무시한다
const BAR_KEEP_TOP = 56;
const BAR_MIN_DELTA = 8;
const MOBILE_QUERY = '(max-width: 899px)';

/**
 * 휴대폰 위 머리 접기 — 아래로 내리면 숨기고, 위로 올리면 다시 보인다. 화면을 옮기면 다시 보인다.
 * 데스크톱(900px 이상)에서는 머리 자체가 없어 아무것도 하지 않는다.
 */
function useBarCollapse(pathname: string): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    const mq = window.matchMedia(MOBILE_QUERY);
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (!mq.matches || y <= BAR_KEEP_TOP) {
          setHidden(false);
          lastY = y;
          return;
        }
        const dy = y - lastY;
        if (Math.abs(dy) < BAR_MIN_DELTA) return;
        setHidden(dy > 0);
        lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return [hidden, () => setHidden(false)];
}

/**
 * 로그인 뒤 화면의 틀 — app/(app)/layout.tsx 가 한 번만 그린다(이동할 때 메뉴가 다시 만들어지지 않는다).
 * 보드/표 · 데스크톱/모바일 네 가지 틀을 모두 그리고, 무엇을 보일지는 CSS(테마·화면 폭)가 정한다 → 깜빡임 없음.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = normPath(usePathname());
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = !!getToken();
    setAuthed(ok);
    if (!ok && !PUBLIC_PATHS.includes(pathname)) {
      // 로그인 뒤 이 화면으로 돌아오게 (공유받은 방 링크 등)
      try {
        sessionStorage.setItem('postLoginRedirect', `${pathname}${window.location.search}`);
      } catch {
        /* 무시 */
      }
      router.replace('/');
    }
  }, [pathname, router]);

  if (authed === null) return <div className={styles.boot} aria-hidden />;

  if (!authed) {
    if (!PUBLIC_PATHS.includes(pathname)) return <div className={styles.boot} aria-hidden />;
    return (
      <div className={styles.publicShell}>
        <header className={styles.publicBar}>
          <BrandMark href="/" />
          <span className="ui-spacer" />
          <ThemeSwitch local />
          <Link href="/" className="ui-btn ui-btn--sm ui-btn--primary">
            로그인
          </Link>
        </header>
        <main id="main">{children}</main>
      </div>
    );
  }

  return (
    <ShellProvider>
      <ShellFrame pathname={pathname}>{children}</ShellFrame>
    </ShellProvider>
  );
}

function ShellFrame({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { me, inbox, rooms } = useShell();
  const [accountOpen, setAccountOpen] = useState(false);
  const [barHidden, showBar] = useBarCollapse(pathname);
  const ownHead = OWN_HEAD_PATHS.includes(pathname);
  const inboxN = inboxCount(inbox);
  const peopleDot = inbox.friendRequests.length > 0;
  const name = me ? displayName(me) : '';

  const badgeFor = (href: string) =>
    href === '/home' && inboxN > 0 ? (
      <span className="ui-badge ui-badge--primary" aria-label={`답할 것 ${inboxN}개`}>
        {inboxN > 99 ? '99+' : inboxN}
      </span>
    ) : href === '/friends' && peopleDot ? (
      <span className="ui-dot" aria-label="받은 친구 요청 있음" />
    ) : null;

  const avatarBtn = (cls: string) => (
    <button type="button" className={cls} onClick={() => setAccountOpen(true)} aria-label="계정 메뉴">
      <Avatar src={me?.picture} name={name} id={me?._id} size="sm" />
    </button>
  );

  return (
    <div className={styles.shell} data-own-head={ownHead || undefined}>
      <a href="#main" className={styles.skip}>
        본문으로 건너뛰기
      </a>

      {/* 보드 · 데스크톱 — 왼쪽 메뉴 */}
      <nav className={styles.sidebar} aria-label="주 메뉴">
        <div className={styles.sideBrand}>
          <BrandMark />
        </div>
        <ul className={styles.sideNav}>
          {[...NAV, LEAVE_LINK].map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={n.match(pathname) ? 'page' : undefined}>
                <Icon name={n.icon} size={18} />
                <span className={styles.sideLabel}>{n.label}</span>
                {badgeFor(n.href)}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.sideRooms}>
          <div className={styles.sideHeading}>내 모임</div>
          {rooms === null ? (
            <span className="ui-skeleton" />
          ) : (
            <ul>
              {rooms.slice(0, 6).map((r) => {
                const st = roomStatus(r);
                const href = `/rooms/detail?id=${r._id}`;
                return (
                  <li key={r._id}>
                    <Link href={href} className={styles.sideRoom} data-tone={st.tone}>
                      <span className={styles.sideRoomDot} aria-hidden />
                      <span className={styles.sideRoomName}>{r.name}</span>
                      <span className={styles.sideRoomTag}>{st.label}</span>
                    </Link>
                  </li>
                );
              })}
              {rooms.length > 6 && (
                <li>
                  <Link href="/rooms" className={styles.sideMore}>
                    모두 보기 ({rooms.length})
                  </Link>
                </li>
              )}
            </ul>
          )}
          <Link href="/rooms?new=1" className={styles.sideNew}>
            <Icon name="plus" size={16} />새 모임
          </Link>
        </div>

        <div className={styles.sideFoot}>
          <div className={styles.sideTheme}>
            <span>화면</span>
            <ThemeSwitch />
          </div>
          <button type="button" className={styles.sideAccount} onClick={() => setAccountOpen(true)}>
            <Avatar src={me?.picture} name={name} id={me?._id} size="sm" />
            <span className={styles.sideAccountText}>
              <strong>{name || ' '}</strong>
              <span>계정 · 설정</span>
            </span>
          </button>
        </div>
      </nav>

      {/* 표 · 데스크톱 — 위 남색 메뉴 */}
      <header className={styles.topbar}>
        <BrandMark />
        <nav aria-label="주 메뉴" className={styles.topNav}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={n.match(pathname) ? 'page' : undefined}>
              {n.label}
              {badgeFor(n.href)}
            </Link>
          ))}
        </nav>
        <Link href={LEAVE_LINK.href} className={styles.topLink} aria-current={LEAVE_LINK.match(pathname) ? 'page' : undefined}>
          <Icon name="sun" size={16} />
          {LEAVE_LINK.label}
        </Link>
        <ThemeSwitch />
        {avatarBtn(styles.topAvatar)}
      </header>

      {/* 모바일 — 위 머리 (내리면 접힌다. 포커스가 들어오면 다시 보인다) */}
      <header className={styles.mobilebar} data-hidden={barHidden || undefined} onFocus={showBar}>
        <BrandMark size={26} />
        <span className="ui-spacer" />
        {avatarBtn(styles.topAvatar)}
      </header>

      <main id="main" className={styles.main}>
        {children}
      </main>

      {/* 모바일 — 아래 탭 */}
      <nav className={styles.tabs} aria-label="주 메뉴">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={n.match(pathname) ? 'page' : undefined}>
            <span className={styles.tabIcon}>
              <Icon name={n.icon} size={22} />
              {badgeFor(n.href)}
            </span>
            {n.label}
          </Link>
        ))}
      </nav>

      {accountOpen && <AccountDrawer onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
