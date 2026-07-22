// dev 서버가 응답하면 기본 브라우저로 열어주는 스크립트 (의존성 없음, Windows 기준)
// 사용: node scripts/open-browser.mjs <url> [--bg]
//  --bg: 자신을 백그라운드(detached)로 다시 띄우고 즉시 종료 — 직렬 npm 스크립트 체인용
import http from 'node:http'
import { exec, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const url = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:3000'

if (process.argv.includes('--bg')) {
  spawn(process.execPath, [fileURLToPath(import.meta.url), url], { detached: true, stdio: 'ignore' }).unref()
  process.exit(0)
}

// 서버가 뜰 때까지 0.5초 간격 폴링 (최대 60초), 응답이 오면 브라우저 오픈 후 종료
const deadline = Date.now() + 60_000
const tick = () => {
  http
    .get(url, () => exec(`start "" "${url}"`))
    .on('error', () => {
      if (Date.now() < deadline) setTimeout(tick, 500)
    })
}
tick()
