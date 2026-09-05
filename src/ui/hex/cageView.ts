// ui/hex/cageView.ts — 케이지 렌더와 구출 연출.
// 케이지는 셀 맵에서 사라지는 것으로 "구출됨"을 표현하므로,
// 이 뷰는 stage.cages(고정 목록)와 state.rescued를 대조해 그린다.
//
// 구출은 세 박자다:
//   ① 잠김  — 창살 **시퀀스**(tex.locked[animalId])를 계속 돌린다. 아트가 없을 때만
//             코드가 그린 창살 + 상하 흔들림 목업으로 폴백한다.
//   ② 해제  — 자물쇠가 떨어지고, 열린 창살 **스틸**(tex.open[animalId])이 그 자리를 덮는다.
//   ③ 탈출  — 창살이 좌우로 흔들리다 회전하며 떨어지고, 그 자리에서 동물 **네 마리**가
//             격자 한 칸 크기로 나와 바닥까지 떨어진다. 떨어질수록 커지고(카메라 쪽으로
//             다가온다는 뜻이다), 우리 하단 경계에 닿으면 오른쪽으로 빠르게 걸어 나간다.
//             걷는 동안 동물 시퀀스가 돈다 — 아트가 오면 그대로 걷는 그림이 된다.
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { makeSequence, type SequenceView } from "../sequence";
import { fitContain } from "../skin";
import { cellToScreen, penEdges, HEX_SIZE, CELL_W, PEN } from "./geom";
import {
  cageShakeX, cageDropY, cageDropRot, cageDropAlpha, CAGE_TOTAL_MS,
  spawnEscape, stepEscape, ANIMAL_COUNT, LAND_SCALE,
  type EscapeArena,
} from "./escapeMotion";
import type { Cage, RunState } from "../../engine/hex/types";
import { cageProgress } from "../../engine/hex/cageFaces";

export interface CageTextures {
  /** 창살(잠금) — 동물마다 시퀀스. 한 장이면 스틸. 없는 동물은 코드 폴백 */
  locked: Record<string, readonly Texture[]>;
  /** 창살(해제) — 동물마다 스틸 한 장. 없으면 폴백 연출만 돈다 */
  open: Record<string, Texture>;
  /** 동물마다 시퀀스. 한 장이면 스틸 */
  animals: Record<string, readonly Texture[]>;
}

export interface CageView {
  root: Container;
  /** 케이지 목록과 화면을 맞춘다.
   *  **주의 — 호출 순서 계약:** state.rescued에 들어간 케이지는 여기서 파괴된다.
   *  구출 연출을 보여주려면 이 함수보다 playRescue를 **먼저** 불러야 한다.
   *  (연출 중인 케이지는 animating 가드가 지켜주지만, 연출이 시작조차 안 했으면
   *   지켜줄 것이 없다.) */
  sync(state: RunState): void;
  /** 구출 연출(해제 → 낙하)을 재생하고, 끝나면 몸체를 스스로 치운다.
   *  연출이 끝날 때 resolve된다 — 호출자가 순차로 await할 수 있다.
   *  **sync가 이미 그 케이지를 지웠다면 아무 일도 하지 않고 즉시 resolve한다** —
   *  이 경우 연출은 보이지 않는다. 위 sync의 순서 계약 참조. */
  playRescue(cage: Cage): Promise<void>;
  /** 유휴 흔들림과 창살 시퀀스를 멈춘다 — 설정창이 열려 있는 동안 화면이 정말로 멎게. */
  pause(): void;
  /** 흔들림과 창살 시퀀스를 되살린다. */
  resume(): void;
  destroy(): void;
}

// ── 연출 상수 — 한곳에 모아 둔다 ──────────────────────────────
const IDLE_BOB_PX = 1.6;      // 잠김 idle 진폭
const IDLE_BOB_HZ = 0.35;
const UNLOCK_MS = 320;        // 자물쇠가 떨어지고 창살이 열리기까지
const LOCKED_FPS = 10;        // 잠김 창살 시퀀스 재생 속도
const ANIMAL_FPS = 12;        // 동물 시퀀스 재생 속도
/** 동물이 딛는 바닥 — 타일이 깔려 있던 배경 울타리의 하단 경계다. */
const FLOOR_Y = PEN.lb.y;
/** 안전장치. 어떤 구출 연출도 이보다 길게 끌지 않는다(ms). */
const ESCAPE_TIMEOUT_MS = 6000;

/** 금 색. 처음엔 창살과 같은 흰 계열이었는데 밝은 타일 위에서 금이 아니라 하이라이트로
 *  읽혔다(본선 QA). 깨지는 것은 어둡게 갈라져야 금이다 — 거의 검정으로 긋는다. */
const CRACK_COLOR = 0x140c06;

/** 금이 뻗어 나가는 방향. 면이 하나 열릴 때마다 앞에서부터 한 줄씩 늘어난다.
 *  고정 배열이라 다시 그려도 금이 춤추지 않는다 — 매번 난수로 뽑으면
 *  발사할 때마다 금 모양이 바뀌어 「깨지는 중」이 아니라 노이즈로 보인다. */
const CRACK_RAYS: ReadonlyArray<{ a: number; len: number }> = [
  { a: -1.9, len: 0.85 },
  { a: 0.5, len: 0.95 },
  { a: 2.4, len: 0.8 },
  { a: -0.4, len: 0.7 },
  { a: 1.5, len: 0.9 },
];

/** 상단 면 타일에 금을 긋는다. level은 열린 면 수(0…5). */
function drawCracks(g: Graphics, cells: Array<{ x: number; y: number }>, level: number): void {
  g.clear();
  if (level <= 0) return;
  const r = HEX_SIZE * 0.9;
  for (const p of cells) {
    for (let i = 0; i < Math.min(level, CRACK_RAYS.length); i += 1) {
      const ray = CRACK_RAYS[i]!;
      const len = r * ray.len;
      // 한 번 꺾어 그린다 — 곧은 선은 금이 아니라 빗금으로 보인다
      const midX = p.x + Math.cos(ray.a) * len * 0.55;
      const midY = p.y + Math.sin(ray.a) * len * 0.55;
      g.moveTo(p.x, p.y)
        .lineTo(midX, midY)
        .lineTo(p.x + Math.cos(ray.a + 0.5) * len, p.y + Math.sin(ray.a + 0.5) * len)
        .stroke({ width: 1.4, color: CRACK_COLOR, alpha: 0.35 + 0.13 * level });
    }
  }
}

/** 케이지가 점유한 셀들의 중심점. */
function cageCenter(cage: Cage): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const c of cage.cells) {
    const p = cellToScreen(c);
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / cage.cells.length, y: sy / cage.cells.length };
}

/** flat-top 육각형 꼭짓점 6개. **위아래가 수평**이고 좌우가 뾰족하다.
 *  타일(pointy-top)을 30° 돌린 방향이다 — 창살이 타일과 다른 방향으로 서서
 *  「타일 무리 안에 놓인 다른 물건」으로 읽힌다. */
function flatHexPoints(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(size * Math.cos(angle), size * Math.sin(angle));
  }
  return pts;
}

/** 케이지가 차지한 덩어리를 덮는 flat-top 육각 하나의 반지름.
 *
 *  가로로 가장 먼 칸의 중심까지 거리에 셀 반폭을 더하면 그 칸의 바깥 변에 닿는다.
 *  flat-top 육각은 가로가 세로보다 길어서(2 : √3) 이 값을 쓰면 세로로는 저절로
 *  덩어리 안에 들어온다 — 둘레 타일을 침범하지 않는다.
 *  한 칸짜리 케이지면 dx가 0이라 딱 한 칸 폭의 육각이 된다. */
function cageHexSize(offsets: Array<{ dx: number; dy: number }>): number {
  const cellW = Math.sqrt(3) * HEX_SIZE;
  let maxDx = 0;
  for (const o of offsets) maxDx = Math.max(maxDx, Math.abs(o.dx));
  return maxDx + cellW / 2;
}

/** flat-top 육각형 안에서, 중심으로부터 x만큼 떨어진 세로선의 반높이.
 *  꼭짓점이 (±size, 0)과 (±size/2, ±√3·size/2)이므로 가운데 절반 구간은
 *  높이가 일정하고(수평인 윗변·아랫변), 바깥 절반에서만 빗변을 따라 줄어든다.
 *  이 식으로 창살을 육각 안에 딱 맞춘다 — 마스크를 쓰지 않으므로
 *  케이지마다 렌더 타겟이 늘지 않는다. */
function barHalfHeight(size: number, x: number): number {
  const ax = Math.abs(x);
  const h = (Math.sqrt(3) / 2) * size;
  return ax <= size / 2 ? h : Math.sqrt(3) * (size - ax);
}

function drawBars(g: Graphics, size: number, color: number): void {
  const cellW = Math.sqrt(3) * HEX_SIZE;
  const count = Math.max(3, Math.round((size * 2) / cellW) * 2 + 1);
  for (let i = 0; i < count; i += 1) {
    const x = (i / (count - 1) - 0.5) * 2 * size * 0.88;
    const half = barHalfHeight(size - 3, x) - 2;
    if (half <= 0) continue;
    g.moveTo(x, -half).lineTo(x, half).stroke({ width: 2.5, color });
  }
  g.poly(flatHexPoints(size - 1)).stroke({ width: 3.5, color });
}

const BAR_COLOR = 0xb9c4d2;   // 쇠창살
const CAGE_DARK = 0x1b2430;   // 창살 안쪽 그늘

/** 케이지 몸체. 연출이 부위별로 손대야 해서 조각을 들고 나온다. */
interface CageBody {
  box: Container;
  /** 열림 연출에서 사라지는 부분 — 창살과 자물쇠 */
  bars: Container | null;
  lock: Container | null;
  /** 아트가 있을 때만: 잠긴 창살 시퀀스. 해제 때 이 자리를 열린 스틸이 덮는다 */
  lockedSeq: SequenceView | null;
  size: number;
}

/** 잠김 창살 재생 — 붙일 때와 되살릴 때가 **같은 함수를 거쳐야** 한다.
 *  파라미터가 어긋나면 설정창을 한 번 열고 닫은 뒤부터 창살 속도가 달라진다. */
function playLocked(seq: SequenceView): void {
  void seq.play({ fps: LOCKED_FPS, loop: true });
}

function makeAnimalView(cage: Cage, tex: CageTextures, w: number, h: number): Container {
  const frames = tex.animals[cage.animalId] ?? [];
  if (frames.length > 0) {
    // 동물은 갇혀 있는 동안에도 살아 있어야 한다 — 시퀀스를 계속 돌린다
    const seq = makeSequence(frames, w, h);
    if (seq) {
      void seq.play({ fps: ANIMAL_FPS, loop: true });
      return seq.root;
    }
  }
  // 폴백 — 아트가 오기 전까지 쓰는 목업. 동그란 몸통에 이름표.
  const g = new Container();
  g.addChild(new Graphics().circle(0, 0, Math.min(w, h) / 2).fill({ color: 0xf3e2c0 }));
  const label = new Text({
    text: cage.animalId,
    style: { fontSize: 9, fill: 0x4a3a24, fontWeight: "bold" },
  });
  label.anchor.set(0.5);
  g.addChild(label);
  return g;
}

function makeCageBody(cage: Cage, tex: CageTextures): CageBody {
  const box = new Container();
  const center = cageCenter(cage);
  const offsets = cage.cells.map((c) => {
    const p = cellToScreen(c);
    return { dx: p.x - center.x, dy: p.y - center.y };
  });
  const size = cageHexSize(offsets);
  const w = 2 * size;                    // flat-top: 가로가 꼭짓점 사이
  const h = Math.sqrt(3) * size;          // 세로가 수평 변 사이

  // 그리는 순서가 곧 「갇혀 있다」를 만든다 — 동물을 먼저 깔고 창살을 그 위에 덮는다.
  // 아트 경로에서 순서가 뒤집혀 동물이 창살 앞에 서 있었다.
  // 창살은 **동물마다 따로 판단한다** — 한 종만 도착해도 그 종은 아트로 그려야 한다
  // 재생기를 **먼저** 만든다 — 그늘·동물을 깔고 나서 실패하면 아래 폴백이
  // 같은 box에 두 번째 그늘과 두 번째 동물을 겹쳐 그린다.
  const lockedFrames = tex.locked[cage.animalId] ?? [];
  // 덩어리 전체를 덮는 큰 flat-top 육각 — 가로:세로 = 2 : √3
  const lockedSeq = lockedFrames.length > 0 ? makeSequence(lockedFrames, w, h) : null;
  if (lockedSeq) {
    // 아트가 있으면: 그늘 → 동물 → 창살 시퀀스(안쪽이 비어 있어 동물이 비쳐 보인다)
    box.addChild(new Graphics().poly(flatHexPoints(size - 1)).fill(CAGE_DARK));
    box.addChild(makeAnimalView(cage, tex, w * 0.5, h * 0.5));
    // 갇혀 있는 동안 계속 돈다 — 한 장짜리는 makeSequence가 스틸로 다룬다
    playLocked(lockedSeq);
    box.addChild(lockedSeq.root);
    return { box, bars: null, lock: null, lockedSeq, size };
  }

  // 아트가 없으면: 그늘 → 동물 → 코드가 그린 창살·자물쇠
  box.addChild(new Graphics().poly(flatHexPoints(size - 1)).fill(CAGE_DARK));
  box.addChild(makeAnimalView(cage, tex, w * 0.62, h * 0.62));

  const bars = new Graphics();
  drawBars(bars, size, BAR_COLOR);
  const lock = new Graphics();
  lock.roundRect(-9, -6, 18, 13, 3).fill({ color: 0xe4ebf3 });
  lock.circle(0, 0, 3).fill({ color: CAGE_DARK });
  lock.y = h / 2 - 11;
  box.addChild(bars, lock);

  return { box, bars, lock, lockedSeq: null, size };
}

/** 끝나는 시점을 스스로 판단하는 rAF 루프. onFrame이 false를 돌려주면 끝난다.
 *  `timeoutMs`는 안전장치다 — 판정이 틀려도 연출이 영원히 살지 않게 한다. */
function animateUntil(timeoutMs: number, onFrame: (elapsedMs: number) => boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = (): void => {
      const elapsed = performance.now() - start;
      if (!onFrame(elapsed) || elapsed >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** rAF 루프를 Promise로 감싼다. onFrame이 false를 돌려주거나 시간이 다하면 끝난다. */
function animate(durationMs: number, onFrame: (t: number) => boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      if (!onFrame(t)) {
        resolve();
        return;
      }
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });
}

export function createCageView(textures: CageTextures): CageView {
  const root = new Container();
  /** 낙하하는 동물이 사는 층. 케이지 몸체보다 위에 둔다 — 창살 앞으로 쏟아져 나온다. */
  const fallLayer = new Container();
  const bodyLayer = new Container();
  /** 상단 면 타일 위에 얹는 금. 타일보다는 위, 케이지 몸체보다는 아래. */
  const crackLayer = new Container();
  root.addChild(crackLayer, bodyLayer, fallLayer);

  interface Entry { body: CageBody; baseY: number; phase: number; crack: Graphics; crackLevel: number }

  /** 케이지 하나를 화면에서 걷어 낸다. 창살 시퀀스의 rAF를 먼저 세운다 —
   *  노드만 부수면 다음 프레임까지 파괴된 스프라이트를 만진다. */
  function dropBody(entry: Entry): void {
    entry.body.lockedSeq?.stop();
    if (!entry.body.box.destroyed) entry.body.box.destroy({ children: true });
    if (!entry.crack.destroyed) entry.crack.destroy();
  }
  const bodies = new Map<string, Entry>();
  const animating = new Set<string>();
  let idleRaf = 0;

  /** 상단 면의 금을 진행도에 맞춘다. 값이 그대로면 다시 그리지 않는다. */
  function syncCracks(state: RunState, cage: Cage, entry: Entry): void {
    const p = cageProgress(state.cells, cage);
    // 6면 구조가 없는 케이지는 상단 면도 없다 — 금을 그릴 자리가 없다
    const level = p.fallback ? 0 : p.opened;
    if (level === entry.crackLevel || entry.crack.destroyed) return;
    entry.crackLevel = level;
    drawCracks(entry.crack, p.topFace.map(cellToScreen), level);
  }

  /** 흔들 케이지가 하나라도 있나. 아트가 다 올라오면 0이 된다 —
   *  그때도 rAF를 돌리면 매 프레임 아무것도 안 하는 루프가 영원히 산다. */
  function needsIdle(): boolean {
    for (const e of bodies.values()) if (!e.body.lockedSeq && !e.body.box.destroyed) return true;
    return false;
  }

  /** 잠김 idle — **아트가 없는 케이지만** 흔든다. 창살 시퀀스가 있으면 살아 있는
   *  느낌은 아트가 만들므로, 코드가 겹쳐 흔들면 두 움직임이 싸운다.
   *  연출 중인 케이지는 건드리지 않는다. */
  function startIdle(): void {
    if (idleRaf !== 0 || !needsIdle()) return;
    const tick = (): void => {
      idleRaf = 0;
      if (root.destroyed || !needsIdle()) return;
      const t = performance.now() / 1000;
      for (const [id, e] of bodies) {
        if (animating.has(id) || e.body.box.destroyed || e.body.lockedSeq) continue;
        e.body.box.y = e.baseY + Math.sin(t * Math.PI * 2 * IDLE_BOB_HZ + e.phase) * IDLE_BOB_PX;
      }
      idleRaf = requestAnimationFrame(tick);
    };
    idleRaf = requestAnimationFrame(tick);
  }

  function stopIdle(): void {
    if (idleRaf !== 0) cancelAnimationFrame(idleRaf);
    idleRaf = 0;
  }

  /** ② 해제 — 자물쇠가 떨어지고, 열린 창살 스틸이 잠긴 창살을 덮는다. */
  async function playUnlock(cage: Cage, entry: Entry): Promise<void> {
    const { box, bars, lock, lockedSeq, size } = entry.body;

    // 열린 창살은 스틸 한 장이라 「열리는 과정」이 없다 — 페이드로 갈아탄다.
    // 잠긴 쪽을 곧바로 지우지 않는 이유는, 한 프레임이라도 빈 칸이 보이면
    // 우리가 사라진 것처럼 깜빡이기 때문이다.
    let openSprite: Sprite | null = null;
    const openTex = textures.open[cage.animalId];
    if (openTex && !box.destroyed) {
      openSprite = new Sprite(openTex);
      openSprite.anchor.set(0.5);
      fitContain(openSprite, 2 * size, Math.sqrt(3) * size); // 원본 비율 유지
      openSprite.alpha = 0;
      box.addChild(openSprite);
    }

    const lockFromY = lock?.y ?? 0;
    await animate(UNLOCK_MS, (t) => {
      if (box.destroyed) return false;
      // 자물쇠가 툭 떨어진다
      if (lock && !lock.destroyed) {
        lock.y = lockFromY + 26 * t * t;
        lock.alpha = 1 - t;
        lock.rotation = t * 1.2;
      }
      // 창살이 열린다 — 폴백에서는 흐려지는 것으로 대신한다
      if (bars && !bars.destroyed) bars.alpha = 1 - t * 0.85;
      // 아트가 있으면 잠긴 창살에서 열린 창살로 건너간다
      if (openSprite && !openSprite.destroyed) openSprite.alpha = t;
      if (lockedSeq && !lockedSeq.root.destroyed) lockedSeq.root.alpha = openSprite ? 1 - t : 1 - t * 0.85;
      box.scale.set(1 + 0.06 * Math.sin(Math.PI * t)); // 덜컹
      return true;
    });
  }

  /**
   * ③ 탈출 — 창살이 흔들리다 떨어지고, 그 자리에서 동물 네 마리가 나와
   *   바닥까지 떨어진 뒤 오른쪽으로 걸어 나간다.
   *
   *   두 몸이 **같은 rAF 한 바퀴**를 나눠 쓴다. 따로 돌리면 창살이 먼저 끝나
   *   몸체가 파괴된 뒤에도 동물 루프가 그 좌표를 읽는다.
   */
  async function playEscape(cage: Cage, entry: Entry): Promise<void> {
    const { box } = entry.body;
    const originX = box.x;
    const anchor = { x: originX, y: entry.baseY };
    const arena: EscapeArena = {
      anchor,
      floorY: FLOOR_Y,
      // 우리 오른쪽 벽을 지나 몸통 하나만큼 더 간다 — 경계에서 사라지면 잘려 보인다
      exitX: penEdges(FLOOR_Y).right + CELL_W * LAND_SCALE,
    };

    // 배율 1이 격자 한 칸이 되도록 한 칸 크기로 만든다. 시퀀스는 계속 돈다.
    const runners = Array.from({ length: ANIMAL_COUNT }, (_, i) => {
      const view = makeAnimalView(cage, textures, CELL_W, CELL_W);
      view.x = anchor.x;
      view.y = anchor.y;
      view.alpha = 0;
      fallLayer.addChild(view);
      return { view, body: spawnEscape(i, ANIMAL_COUNT, arena) };
    });

    let last = performance.now();
    try {
      await animateUntil(ESCAPE_TIMEOUT_MS, (elapsed) => {
        if (root.destroyed) return false;
        const now = performance.now();
        // 탭 전환 등으로 프레임이 벌어져도 한 스텝에 안무를 건너뛰지 않게 상한을 둔다
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;

        // 창살 — 자글자글 흔들리다 회전하며 떨어진다
        if (!box.destroyed) {
          box.x = originX + cageShakeX(elapsed);
          box.y = entry.baseY + cageDropY(elapsed);
          box.rotation = cageDropRot(elapsed);
          box.alpha = cageDropAlpha(elapsed);
        }

        let alive = elapsed < CAGE_TOTAL_MS;
        for (const r of runners) {
          stepEscape(r.body, dt, arena);
          if (r.body.phase !== "dead") alive = true;
          if (r.view.destroyed) continue;
          r.view.x = r.body.x;
          r.view.y = r.body.y;
          r.view.alpha = r.body.alpha;
          r.view.scale.set(r.body.scale);
        }
        return alive;
      });
    } finally {
      for (const r of runners) if (!r.view.destroyed) r.view.destroy({ children: true });
    }
  }

  return {
    root,

    sync(state: RunState): void {
      for (const cage of state.cages) {
        const rescued = state.rescued.includes(cage.animalId);
        const existing = bodies.get(cage.id);

        if (rescued) {
          // 구출 연출이 도는 중이면 건드리지 않는다 — playRescue가 끝내고 스스로 치운다
          if (animating.has(cage.id)) continue;
          if (existing) {
            dropBody(existing);
            bodies.delete(cage.id);
          }
          continue;
        }
        if (existing) {
          // 줄이 내려오면 창살도 같이 내려간다(pushRow가 state.cages를 옮긴다). 자리를
          // 만들 때 한 번만 잡으면 몸체는 옛 자리에 남고 실제 케이지는 아래로 내려가
          // 둘레 타일이 허공에 뜬 것처럼 보였다 — 본선 QA 「창살 위치가 고정」.
          // 연출 중인 케이지는 건드리지 않는다: playEscape가 자리를 직접 굴린다.
          if (!animating.has(cage.id)) {
            const p = cageCenter(cage);
            if (existing.baseY !== p.y || existing.body.box.x !== p.x) {
              existing.body.box.x = p.x;
              existing.body.box.y = p.y;
              existing.baseY = p.y;
              existing.crackLevel = -1; // 금은 칸 좌표로 그린다 — 자리가 바뀌면 다시 긋는다
            }
          }
          syncCracks(state, cage, existing);
          continue;
        }

        const body = makeCageBody(cage, textures);
        const p = cageCenter(cage);
        body.box.x = p.x;
        body.box.y = p.y;
        bodyLayer.addChild(body.box);
        // 금은 몸체의 자식이 아니다 — 몸체는 idle로 흔들리는데 금은 타일 위에
        // 붙어 있어야 하므로 같이 흔들리면 안 된다.
        const crack = new Graphics();
        crackLayer.addChild(crack);
        // 케이지마다 위상을 어긋내 여러 개가 한 몸처럼 흔들리지 않게 한다
        bodies.set(cage.id, { body, baseY: p.y, phase: bodies.size * 1.7, crack, crackLevel: -1 });
      }
      // 새로 만든 케이지의 금도 한 번 맞춘다
      for (const cage of state.cages) {
        const e = bodies.get(cage.id);
        if (e) syncCracks(state, cage, e);
      }
      startIdle(); // 흔들 대상이 없으면 스스로 돌아선다
    },

    async playRescue(cage: Cage): Promise<void> {
      const entry = bodies.get(cage.id);
      if (!entry) return;

      animating.add(cage.id);
      try {
        await playUnlock(cage, entry);
        await playEscape(cage, entry);
      } finally {
        // 연출이 끝났으니 스스로 치운다 — 이후 sync가 다시 그리지 않는다
        animating.delete(cage.id);
        dropBody(entry);
        bodies.delete(cage.id);
        if (bodies.size === 0) stopIdle();
      }
    },

    /** 일시정지 — 설정창이 열려 있는 동안 흔들림과 창살을 멈춘다.
     *  멈추지 않으면 「멈춘 게임」 위에서 케이지만 계속 움직여 어색하다.
     *  창살 시퀀스는 idle 흔들림과 **다른 rAF**라 따로 세워야 한다 —
     *  stopIdle만 부르면 아트가 올라온 케이지는 그대로 움직인다. */
    pause(): void {
      stopIdle();
      for (const e of bodies.values()) e.body.lockedSeq?.stop();
    },

    /** 재개. 흔들림은 흔들 케이지가 남아 있을 때만 돌고(startIdle이 스스로 판단한다),
     *  창살은 그와 무관하게 케이지마다 되건다 — 아트가 다 올라오면 흔들림 대상이 0이다.
     *  연출 중인 케이지는 건드리지 않는다: 해제 페이드가 지우고 있는 중이다. */
    resume(): void {
      startIdle();
      for (const [id, e] of bodies) {
        if (animating.has(id) || !e.body.lockedSeq || e.body.lockedSeq.root.destroyed) continue;
        playLocked(e.body.lockedSeq);
      }
    },

    destroy(): void {
      stopIdle(); // rAF가 살아 있으면 파괴된 노드를 계속 만진다
      animating.clear();
      for (const e of bodies.values()) dropBody(e);
      bodies.clear();
      root.destroy({ children: true });
    },
  };
}
