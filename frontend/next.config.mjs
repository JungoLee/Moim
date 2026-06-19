/** @type {import('next').NextConfig} */
const nextConfig = {
  // MVP 단계에서는 빌드 시 ESLint 를 건너뛴다(린트 미설정으로 인한 빌드 중단 방지).
  // 추후 eslint-config-next 추가 후 false 로 되돌릴 것.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
