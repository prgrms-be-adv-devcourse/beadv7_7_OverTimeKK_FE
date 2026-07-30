import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 컨테이너로 SSR 실행 — .next/standalone에 트레이싱된 의존성만 담겨서
  // 이미지가 가벼워진다 (node_modules 전체를 복사할 필요 없음).
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
