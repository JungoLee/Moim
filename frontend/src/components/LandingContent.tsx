// 랜딩의 공개 소개 콘텐츠 — 로그인 없이 보이는 유일한 본문이라 검색 색인의 핵심이다.
// (정적 export 라 이 마크업은 빌드 시 HTML 로 그대로 박힌다)
import { BRAND_NAME } from '@/lib/brand';
import JsonLd from '@/components/JsonLd';
import { SITE_URL, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/seo';
import styles from './LandingContent.module.scss';

const FEATURES = [
  {
    icon: '🗓️',
    title: '모두 되는 날 자동 찾기',
    body:
      '모임 방을 만들어 링크나 코드로 친구를 부르면, 각자 되는 날·안 되는 날·“몇 시 이후 가능”을 찍습니다. ' +
      '전원이 가능한 날짜와, 시간만 조율하면 되는 날짜를 자동으로 모아 보여줘요.',
  },
  {
    icon: '🔒',
    title: '일정마다 공개 범위 선택',
    body:
      '일정별로 공유/비공개를 고를 수 있어요. 비공개로 두면 지정한 그룹 멤버에게만 상세가 보이고, ' +
      '나머지 친구에게는 “이 시간 바쁨”으로만 표시됩니다. 약속은 잡으면서 사생활은 지켜요.',
  },
  {
    icon: '🙋',
    title: '부담 없는 시간 요청',
    body:
      '“이 시간 비워줄 수 있어?”를 친구에게 보내고 수락/거절만 받으면 끝. ' +
      '수락하면 양쪽 캘린더에 일정이 자동으로 생기고, 둘 사이 약속이라 다른 친구에게는 노출되지 않아요.',
  },
  {
    icon: '💬',
    title: '방 안에서 바로 대화',
    body: '날짜를 고르다 막히면 모임 방 채팅으로 바로 조율하세요. 안 읽은 메시지는 배지로 알려줍니다.',
  },
];

const STEPS = [
  { title: '로그인', body: '구글 계정으로 3초, 또는 아무 이메일로 코드를 받아 로그인합니다.' },
  { title: '모임 만들기', body: '모임 방을 만들고 링크나 초대 코드를 친구에게 보냅니다.' },
  { title: '날짜 찍기', body: '각자 달력에서 되는 날을 드래그로 표시합니다.' },
  { title: '날짜 확정', body: '전원이 가능한 날이 자동으로 집계됩니다. 거기서 고르면 끝.' },
];

const FAQ = [
  {
    q: '무료인가요?',
    a: '네, 모든 기능을 무료로 쓸 수 있습니다. 별도 결제나 유료 플랜이 없습니다.',
  },
  {
    q: '친구도 가입해야 하나요?',
    a:
      '모임 방에 참여하려면 로그인이 필요합니다. 구글 계정이 없어도 아무 이메일로 인증 코드를 받아 바로 시작할 수 있어요.',
  },
  {
    q: '제 일정이 친구에게 다 보이나요?',
    a:
      '아니요. 일정마다 공개 범위를 고릅니다. 비공개로 설정하면 지정한 그룹에게만 상세가 보이고, ' +
      '그 외에는 시간대만 “바쁨”으로 표시돼 무슨 일정인지 알 수 없습니다.',
  },
  {
    q: '앱을 설치해야 하나요?',
    a: '설치 없이 웹 브라우저에서 바로 씁니다. 휴대폰 홈 화면에 추가하면 앱처럼 쓸 수 있어요.',
  },
  {
    q: '연차 계산기는 뭔가요?',
    a:
      '남은 연차와 갱신일을 넣으면 주말·공휴일을 엮어 최소 연차로 최장 연휴를 만드는 조합을 추천하는 도구입니다. ' +
      '로그인 없이도 사용할 수 있습니다.',
  },
];

export default function LandingContent() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebApplication',
              name: BRAND_NAME,
              alternateName: `${BRAND_NAME} — ${SITE_TAGLINE}`,
              url: SITE_URL,
              description: SITE_DESCRIPTION,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              inLanguage: 'ko-KR',
              isAccessibleForFree: true,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
              featureList: FEATURES.map((f) => f.title),
            },
            {
              '@type': 'HowTo',
              name: '친구들과 모임 날짜 정하는 법',
              description: '모임 방을 만들고 각자 가능한 날을 표시하면 모두 되는 날이 자동으로 집계됩니다.',
              inLanguage: 'ko-KR',
              step: STEPS.map((s, i) => ({
                '@type': 'HowToStep',
                position: i + 1,
                name: s.title,
                text: s.body,
              })),
            },
            {
              '@type': 'FAQPage',
              inLanguage: 'ko-KR',
              mainEntity: FAQ.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ],
        }}
      />

      <div className={styles.wrap}>
        <section className={styles.section} aria-labelledby="sec-what">
          <h2 id="sec-what" className={styles.h2}>
            약속 잡다가 지치는 이유
          </h2>
          <p className={styles.lead}>
            “언제 시간 돼?”를 단톡방에 던지면 답은 제각각이고, 겨우 모은 날짜는 누군가 안 됩니다.{' '}
            <strong>{BRAND_NAME}</strong>는 각자 되는 날만 찍으면 <strong>모두 비어 있는 날</strong>을 자동으로 찾아줍니다.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="sec-features">
          <h2 id="sec-features" className={styles.h2}>
            주요 기능
          </h2>
          <ul className={styles.grid}>
            {FEATURES.map((f) => (
              <li key={f.title} className={styles.card}>
                <span className={styles.icon} aria-hidden>
                  {f.icon}
                </span>
                <h3 className={styles.h3}>{f.title}</h3>
                <p className={styles.body}>{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="sec-how">
          <h2 id="sec-how" className={styles.h2}>
            쓰는 법 — 4단계
          </h2>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum} aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className={styles.h3}>{s.title}</h3>
                  <p className={styles.body}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="sec-tool">
          <h2 id="sec-tool" className={styles.h2}>
            로그인 없이 쓰는 연차 계산기
          </h2>
          <p className={styles.lead}>
            남은 연차와 갱신일만 넣으면 주말·공휴일(대체공휴일 포함)을 엮어 <strong>최소 연차로 최장 연휴</strong>를 만드는
            조합을 추천합니다. 2026~2031년 공휴일이 들어 있어 징검다리 연휴를 놓치지 않아요.
          </p>
          <a className={styles.toolLink} href="/tools/leave">
            연차 계산기 열기 →
          </a>
        </section>

        <section className={styles.section} aria-labelledby="sec-faq">
          <h2 id="sec-faq" className={styles.h2}>
            자주 묻는 질문
          </h2>
          <dl className={styles.faq}>
            {FAQ.map((f) => (
              <div key={f.q} className={styles.faqItem}>
                <dt className={styles.h3}>{f.q}</dt>
                <dd className={styles.body}>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className={styles.footer}>
          <p>
            © {new Date().getFullYear()} {BRAND_NAME}. 친구들과 스케줄을 공유하고 함께 비는 시간을 찾는 소셜 캘린더.
          </p>
        </footer>
      </div>
    </>
  );
}
