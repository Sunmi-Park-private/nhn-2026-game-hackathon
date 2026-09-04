// 데이터 주도 웹 게임. engine=순수 TS, ui=Pixi.
import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

/** UI 배치 에디터(/ui.html) 저장 엔드포인트. dev 서버에서만 산다.
 *  받은 JSON을 그대로 src/data/uiLayout.json에 쓴다 — 게임은 다음 새로고침에 반영된다. */
function uiLayoutSavePlugin(): Plugin {
  const file = path.resolve('src/data/uiLayout.json')
  return {
    name: 'ui-layout-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__uilayout', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { areas?: unknown }).areas)) {
              throw new Error('areas 배열이 필요합니다')
            }
            fs.writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n')
            res.statusCode = 200
            res.end('ok')
          } catch (err) {
            res.statusCode = 400
            res.end(String(err))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: './',            // 상대경로 — 로컬 파일·WebView에서 그대로 열리도록
  build: {
    target: 'es2020',
    rollupOptions: {
      // 에디터도 함께 빌드한다 — 배포본에서 /ui.html 로 열 수 있다
      input: {
        main: path.resolve('index.html'),
        ui: path.resolve('ui.html'),
      },
    },
  },
  plugins: [uiLayoutSavePlugin()],
  server: {
    allowedHosts: ['.trycloudflare.com'], // 재택 디자이너용 quick tunnel 접속 허용
    watch: {
      // 에디터 저장이 게임 탭을 리로드시키지 않게 한다
      ignored: ['**/src/data/uiLayout.json'],
    },
  },
})
