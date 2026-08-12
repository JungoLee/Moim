/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Workers 정적 자산으로 서빙한다(out/) — 서버 기능은 워커(/api/*)가 담당.
  // 동적 세그먼트를 만들 수 없어 방/프로필 상세는 쿼리스트링(?id=) 경로를 쓴다.
  output: 'export',
  images: { unoptimized: true },
  // MVP 단계에서는 빌드 시 ESLint 를 건너뛴다(린트 미설정으로 인한 빌드 중단 방지).
  // 추후 eslint-config-next 추가 후 false 로 되돌릴 것.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
