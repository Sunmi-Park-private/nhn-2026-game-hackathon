// 데이터 주도 웹 게임. engine=순수 TS, ui=Pixi.
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',            // 상대경로 — 로컬 파일·WebView에서 그대로 열리도록
  build: { target: 'es2020' },
  server: {
    allowedHosts: ['.trycloudflare.com'], // 재택 디자이너용 quick tunnel 접속 허용
  },
})
