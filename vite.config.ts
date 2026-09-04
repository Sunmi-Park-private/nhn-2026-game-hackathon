// 데이터 주도 웹 게임. engine=순수 TS, ui=Pixi.
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const LAYOUT_FILE = path.resolve('src/data/uiLayout.json')
const ASSETS_FILE = path.resolve('src/data/assets.json')
const PUBLIC_DIR = path.resolve('public')

/** 업로드를 허용하는 확장자. 그 외는 거부한다 — 공개 디렉터리에 아무거나 쓰이면 곤란하다. */
const ALLOWED = new Set(['png', 'webp', 'jpg', 'jpeg', 'gif', 'mp4', 'webm', 'mp3', 'wav'])
const MAX_BYTES = 20 * 1024 * 1024

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
}

/** "hex.tiles.0" 같은 점 경로를 읽고 쓴다. 배열 인덱스도 받는다. */
function getPath(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}
function setPath(obj: Record<string, unknown>, dotted: string, value: string): void {
  const keys = dotted.split('.')
  let cur: Record<string, unknown> = obj
  for (const k of keys.slice(0, -1)) {
    const next = cur[k]
    if (next === null || typeof next !== 'object') throw new Error(`경로가 없습니다: ${dotted}`)
    cur = next as Record<string, unknown>
  }
  cur[keys[keys.length - 1]!] = value
}

function collectBody(req: NodeJS.ReadableStream, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) { reject(new Error(`파일이 너무 큽니다 (최대 ${Math.round(limit / 1024 / 1024)}MB)`)); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** UI 배치 저장 — /ui.html 에디터가 부른다. */
function uiLayoutSavePlugin(): Plugin {
  return {
    name: 'ui-layout-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__uilayout', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        void collectBody(req, 4 * 1024 * 1024).then((buf) => {
          const parsed: unknown = JSON.parse(buf.toString('utf8'))
          if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { areas?: unknown }).areas)) {
            throw new Error('areas 배열이 필요합니다')
          }
          fs.writeFileSync(LAYOUT_FILE, JSON.stringify(parsed, null, 2) + '\n')
          res.statusCode = 200
          res.end('ok')
        }).catch((err: unknown) => { res.statusCode = 400; res.end(String(err)) })
      })
    },
  }
}

/**
 * 에셋 업로드 — /ui.html 에디터가 슬롯마다 부른다.
 *
 * 파일을 public/ 아래 매니페스트가 가리키는 자리에 쓰고, 확장자가 다르면
 * 매니페스트 경로도 함께 고친다. 그 뒤 게임 탭에 리로드를 밀어 **바로 반영**한다.
 * 업로드는 dev 서버에서만 산다 — 배포본에는 이 엔드포인트가 없다.
 */
function assetUploadPlugin(): Plugin {
  let server: ViteDevServer | undefined
  return {
    name: 'asset-upload',
    apply: 'serve',
    configureServer(s) {
      server = s
      s.middlewares.use('/__upload', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        const url = new URL(req.url ?? '', 'http://x')
        const dotted = url.searchParams.get('asset') ?? ''
        const ext = (url.searchParams.get('ext') ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

        void collectBody(req, MAX_BYTES).then((buf) => {
          if (!dotted) throw new Error('asset 파라미터가 필요합니다')
          if (!ALLOWED.has(ext)) throw new Error(`허용하지 않는 확장자: ${ext}`)
          if (buf.length === 0) throw new Error('빈 파일입니다')

          const manifest = readJson(ASSETS_FILE)
          const current = getPath(manifest, dotted)
          if (typeof current !== 'string') throw new Error(`매니페스트에 없는 경로: ${dotted}`)

          // 매니페스트가 가리키는 자리에 그대로 쓴다. 확장자만 업로드한 것으로 바꾼다.
          const rel = current.replace(/\.[^./]+$/, '') + '.' + ext
          const abs = path.resolve(PUBLIC_DIR, rel)
          // public 밖으로 빠져나가는 경로는 거부한다
          if (!abs.startsWith(PUBLIC_DIR + path.sep)) throw new Error('경로가 public 밖입니다')

          fs.mkdirSync(path.dirname(abs), { recursive: true })
          fs.writeFileSync(abs, buf)

          if (rel !== current) {
            setPath(manifest, dotted, rel)
            fs.writeFileSync(ASSETS_FILE, JSON.stringify(manifest, null, 2) + '\n')
          }

          // 게임 탭에 즉시 반영 — 새로고침 없이 확인할 수 있어야 배치를 조정할 수 있다
          server?.ws.send({ type: 'full-reload', path: '*' })

          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ file: rel, bytes: buf.length }))
        }).catch((err: unknown) => { res.statusCode = 400; res.end(String(err)) })
      })
    },
  }
}

export default defineConfig({
  base: './',            // 상대경로 — 로컬 파일·WebView에서 그대로 열리도록
  build: {
    target: 'es2020',
    rollupOptions: {
      // 에디터도 함께 빌드한다 — 배포본에서 /ui.html 로 열 수 있다(업로드는 dev 전용)
      input: {
        main: path.resolve('index.html'),
        ui: path.resolve('ui.html'),
      },
    },
  },
  plugins: [uiLayoutSavePlugin(), assetUploadPlugin()],
  server: {
    allowedHosts: ['.trycloudflare.com'], // 재택 디자이너용 quick tunnel 접속 허용
    watch: {
      // 배치 저장이 게임 탭을 리로드시키지 않게 한다 — 업로드는 ws로 직접 민다
      ignored: ['**/src/data/uiLayout.json'],
    },
  },
})
