// 구글 애드센스 게시자 ID 단일 출처 — 공개값이라 NEXT_PUBLIC_ 환경변수로 주입.
// 형식: 'ca-pub-XXXXXXXXXXXXXXXX' (애드센스 승인 후 발급). 미설정이면 광고는 렌더되지 않는다.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';
