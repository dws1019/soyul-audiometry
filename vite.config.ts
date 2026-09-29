import { realpathSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

const root = process.cwd()

// 모든 처리는 브라우저 안에서 이루어집니다. 외부 서버로 전송하는 코드는 없습니다.
export default defineConfig({
  plugins: [react()],
  worker: {
    // 음원 생성 Web Worker를 ES 모듈로 번들링
    format: 'es',
  },
  server: {
    port: 5173,
    // 같은 네트워크의 태블릿에서 열어 보려면 `npm run dev -- --host` 로 실행하세요.
    fs: {
      // 심볼릭 링크·OS 폴더 리디렉션 아래에 프로젝트가 있어도 Worker 파일을 제공할 수 있도록 실제 경로도 허용
      allow: [searchForWorkspaceRoot(root), realpathSync.native(root)],
    },
  },
})
