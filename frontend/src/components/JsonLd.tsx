// 구조화 데이터(JSON-LD) 삽입 — 검색결과 리치 스니펫용.
// 서버 컴포넌트로 렌더되어 HTML 에 그대로 박히므로 크롤러가 바로 읽는다.
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // 값은 우리가 만든 정적 객체 — 사용자 입력이 섞이지 않는다
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
