// 데이터 주도 웹 게임. engine=순수 TS, ui=Pixi.
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const LAYOUT_FILE = path.resolve('src/data/uiLayout.json')
const ASSETS_FILE = path.resolve('src/data/assets.json')
const PUBLIC_DIR = path.resolve('public')

/**
 * png·jpg를 webp로 바꾼다. 용량이 줄고 디코딩도 빨라진다.
 *
 * `-lossless`로 원본 픽셀을 그대로 두고, `-exact`로 **투명 픽셀의 RGB까지 보존**한다.
 * 이 옵션이 없으면 알파 0인 자리의 색이 뭉개져 확대했을 때 가장자리에 얼룩이 남는다.
 * cwebp가 없는 환경이면 조용히 원본을 그대로 쓴다 — 업로드가 실패하면 안 된다.
 */
function toWebp(abs: string): string | null {
  if (!/\.(png|jpe?g)$/i.test(abs)) return null
  const out = abs.replace(/\.[^./]+$/, '.webp')
  try {
    execFileSync('cwebp', ['-quiet', '-lossless', '-exact', '-q', '100', abs, '-o', out])
  } catch {
    return null // cwebp 없음·변환 실패 — 원본을 그대로 둔다
  }
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) return null
  fs.unlinkSync(abs)
  return out
}

/** 업로드를 허용하는 확장자. 그 외는 거부한다 — 공개 디렉터리에 아무거나 쓰이면 곤란하다. */
const ALLOWED = new Set(['png', 'webp', 'jpg', 'jpeg', 'gif', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'm4a'])
const MAX_BYTES = 20 * 1024 * 1024

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
}

/** 파일을 watch에서 뺐으므로 vite가 스스로 갱신하지 않는다.
 *  모듈 캐시를 직접 무효화해야 다음 로드가 디스크의 새 내용을 읽는다. */
function touch(server: ViteDevServer | undefined, file: string): void {
  const mod = server?.moduleGraph.getModuleById(file)
  if (mod) server?.moduleGraph.invalidateModule(mod)
}

function serveJson(res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s: string) => void }, file: string): void {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(fs.readFileSync(file, 'utf8'))
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

/** 배치 파일의 리비전 = 마지막으로 쓰인 시각. 에디터가 둘이라 「내가 읽어 온 뒤로
 *  누가 썼나」를 **서버가** 판정해야 한다 — 클라이언트가 GET으로 견주고 POST하면
 *  그 사이에 들어온 쓰기를 통째로 덮어쓴다(자동 저장은 600ms 간격으로 온다). */
/** 이 서버가 파일을 쓴 횟수. mtime만으로는 부족하다 — mtime 해상도가 1초인
 *  파일시스템(HFS+·일부 네트워크/컨테이너 마운트)에서는 같은 초에 일어난 두 번의
 *  쓰기가 같은 값을 내고, 배치 편집은 길이가 그대로인 경우가 흔하다("x": 140 → 150).
 *  그러면 검사가 조용히 통과해 이 장치가 막으려는 덮어쓰기가 그대로 일어난다.
 *  서버가 다시 뜨면 0으로 돌아가지만 그때는 mtime 쪽이 파일이 그대로임을 말해 준다. */
let layoutWrites = 0

function layoutRev(): string {
  try {
    const st = fs.statSync(LAYOUT_FILE)
    return `${st.mtimeMs}-${st.size}-${layoutWrites}`
  } catch { return '0' }
}

/** UI 배치 저장 — /ui.html 에디터와 게임 화면 에디터가 함께 부른다. */
function uiLayoutSavePlugin(): Plugin {
  return {
    name: 'ui-layout-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__assets', (req, res) => {
        if (req.method === 'GET') { serveJson(res, ASSETS_FILE); return }
        // 숫자 하나(예: hex.horseHold)를 고치려고 이미지를 올릴 수는 없다 —
        // 배치 저장(/__uilayout)과 같은 모양으로 매니페스트 전체를 받는다.
        if (req.method !== 'POST') { res.statusCode = 405; res.end('GET/POST only'); return }
        void collectBody(req, 1024 * 1024).then((buf) => {
          const parsed: unknown = JSON.parse(buf.toString('utf8'))
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('매니페스트 객체가 필요합니다')
          }
          fs.writeFileSync(ASSETS_FILE, JSON.stringify(parsed, null, 2) + '\n')
          touch(server, ASSETS_FILE)
          // touch는 모듈 그래프만 무효화한다 — 돌고 있는 게임 탭은 아무것도 모른다.
          // 업로드 경로와 같은 이벤트를 보내 게임만 새로 띄운다. 이게 없으면
          // 디자이너가 프레임을 찍고 「저장됨」을 봐도 화면은 옛 값을 계속 쓴다.
          // asset 이름은 'audio.'로 시작하지 않아야 게임이 리로드한다(main.ts 참조).
          server.ws.send({ type: 'custom', event: 'asset-updated', data: { asset: 'hex.manifest' } })
          res.statusCode = 200
          res.end('ok')
        }).catch((err: unknown) => { res.statusCode = 400; res.end(String(err)) })
      })
      server.middlewares.use('/__uilayout', (req, res) => {
        // watch 제외 파일이라 번들 모듈이 옛 내용일 수 있다 — 에디터가 디스크와 맞춘다
        if (req.method === 'GET') {
          res.setHeader('x-layout-rev', layoutRev())
          serveJson(res, LAYOUT_FILE)
          return
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end('GET/POST only'); return }
        // 누가 썼는지 실어 보낸다 — 받는 쪽이 자기 메아리를 무시할 수 있어야
        // 저장 직후 자기가 방금 쓴 값을 다시 읽어 들이는 왕복이 생기지 않는다
        const q = new URL(req.url ?? '', 'http://x').searchParams
        const by = q.get('by') ?? ''
        const rev = q.get('rev')
        void collectBody(req, 4 * 1024 * 1024).then((buf) => {
          const parsed: unknown = JSON.parse(buf.toString('utf8'))
          if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { areas?: unknown }).areas)) {
            throw new Error('areas 배열이 필요합니다')
          }
          // 읽어 간 뒤로 파일이 바뀌었으면 **쓰지 않는다.** areas를 통째로 덮는
          // 저장이라 그냥 쓰면 다른 에디터의 편집이 자국 없이 사라진다.
          // 판정을 쓰기 직전 서버에서 하는 것이 요점이다 — 클라이언트가 미리
          // 견주면 그 사이에 들어온 쓰기를 놓친다.
          // rev=force는 「덮어쓰기」를 사람이 눌렀다는 뜻이다.
          const now = layoutRev()
          if (rev === null) throw new Error('rev 파라미터가 필요합니다')
          if (rev !== 'force' && rev !== now) {
            res.statusCode = 409
            res.setHeader('x-layout-rev', now)
            res.end('디스크가 더 새롭습니다')
            return
          }
          fs.writeFileSync(LAYOUT_FILE, JSON.stringify(parsed, null, 2) + '\n')
          layoutWrites += 1
          res.setHeader('x-layout-rev', layoutRev())
          touch(server, LAYOUT_FILE)
          // 배치가 바뀐 것을 **모든 탭에** 알린다. 이 알림이 없으면 /ui.html은
          // 부팅 때 읽은 값을 영영 들고 있다가 저장할 때 남의 편집을 덮어쓴다.
          server.ws.send({ type: 'custom', event: 'layout-updated', data: { by } })
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
        const url = new URL(req.url ?? '', 'http://x')
        const dotted = url.searchParams.get('asset') ?? ''
        const ext = (url.searchParams.get('ext') ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

        // 업로드 파일 삭제 — 슬롯은 폴백으로 돌아간다. 매니페스트 경로는 그대로 둔다.
        if (req.method === 'DELETE') {
          try {
            const manifest = readJson(ASSETS_FILE)
            const current = getPath(manifest, dotted)
            const files = Array.isArray(current) ? current.filter((v): v is string => typeof v === 'string')
              : typeof current === 'string' ? [current] : []
            if (files.length === 0) throw new Error(`매니페스트에 없는 경로: ${dotted}`)
            for (const f of files) {
              const abs = path.resolve(PUBLIC_DIR, f)
              if (!abs.startsWith(PUBLIC_DIR + path.sep)) throw new Error('경로가 public 밖입니다')
              if (fs.existsSync(abs)) fs.unlinkSync(abs)
            }
            server?.ws.send({ type: 'custom', event: 'asset-updated', data: { asset: dotted, file: files[0], deleted: true } })
            res.statusCode = 200
            res.end('ok')
          } catch (err) { res.statusCode = 400; res.end(String(err)) }
          return
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST/DELETE only'); return }

        void collectBody(req, MAX_BYTES).then((buf) => {
          if (!dotted) throw new Error('asset 파라미터가 필요합니다')
          if (!ALLOWED.has(ext)) throw new Error(`허용하지 않는 확장자: ${ext}`)
          if (buf.length === 0) throw new Error('빈 파일입니다')

          const manifest = readJson(ASSETS_FILE)
          const raw = getPath(manifest, dotted)
          // 시퀀스로 바뀐 슬롯은 배열이다 — 첫 프레임을 기준 경로로 삼는다
          const current = Array.isArray(raw) ? (raw.find((v) => typeof v === 'string') as string | undefined) : raw
          if (typeof current !== 'string') throw new Error(`매니페스트에 없는 경로: ${dotted}`)

          // 시퀀스 업로드 — 프레임마다 한 번씩 온다. 마지막 프레임에서 매니페스트를 배열로 바꾼다.
          const seqIndex = Number(url.searchParams.get('seq') ?? '-1')
          const seqTotal = Number(url.searchParams.get('total') ?? '0')
          const isSeq = seqIndex >= 0 && seqTotal > 0

          // 매니페스트가 가리키는 자리를 기준으로 쓴다. 확장자는 업로드한 것으로 바꾼다.
          const base = current.replace(/(_f\d+)?\.[^./]+$/, '')
          const rel = isSeq
            ? `${base}_f${String(seqIndex).padStart(3, '0')}.${ext}`
            : `${base}.${ext}`
          const abs = path.resolve(PUBLIC_DIR, rel)
          // public 밖으로 빠져나가는 경로는 거부한다
          if (!abs.startsWith(PUBLIC_DIR + path.sep)) throw new Error('경로가 public 밖입니다')

          fs.mkdirSync(path.dirname(abs), { recursive: true })
          fs.writeFileSync(abs, buf)

          // png·jpg는 webp로 바꾼다 — 매니페스트에 들어가는 이름도 그 결과를 따른다
          const converted = toWebp(abs)
          const finalRel = converted ? rel.replace(/\.[^./]+$/, '.webp') : rel
          const finalExt = converted ? 'webp' : ext

          if (isSeq) {
            // 프레임이 다 올라온 뒤에 한 번만 쓴다 — 중간에 쓰면 게임이 반쪽 시퀀스를 읽는다
            if (seqIndex === seqTotal - 1) {
              const list = Array.from({ length: seqTotal }, (_, i) => `${base}_f${String(i).padStart(3, '0')}.${finalExt}`)
              setPath(manifest, dotted, list as unknown as string)
              fs.writeFileSync(ASSETS_FILE, JSON.stringify(manifest, null, 2) + '\n')
              // 예전에 스틸로 올렸던 파일이 남아 있으면 지운다 — 안 쓰는데 리포에 남는다
              const stale = path.resolve(PUBLIC_DIR, `${base}.${finalExt}`)
              if (stale.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(stale)) fs.unlinkSync(stale)
            }
          } else if (finalRel !== current) {
            setPath(manifest, dotted, finalRel)
            fs.writeFileSync(ASSETS_FILE, JSON.stringify(manifest, null, 2) + '\n')
          }

          // 게임 탭에만 알린다. full-reload를 쓰면 에디터 탭까지 리로드돼
          // 방금 올린 이미지 요청이 중단되고 「미업로드」로 오탐한다.
          touch(server, ASSETS_FILE)
          server?.ws.send({ type: 'custom', event: 'asset-updated', data: { asset: dotted, file: rel } })

          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({
            file: finalRel,
            bytes: fs.existsSync(path.resolve(PUBLIC_DIR, finalRel)) ? fs.statSync(path.resolve(PUBLIC_DIR, finalRel)).size : buf.length,
            converted: converted !== null,
          }))
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
      // 에디터가 쓰는 파일은 watch에서 뺀다 — 저장·업로드마다 전 탭이 리로드되면
      // 방금 올린 이미지 요청이 중단돼 「미업로드」로 오탐한다. 반영은 ws로 직접 민다.
      ignored: ['**/src/data/uiLayout.json', '**/src/data/assets.json'],
    },
  },
})
