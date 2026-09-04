// ui/hex/cageView.ts — 케이지 렌더와 구출 연출.
// 케이지는 셀 맵에서 사라지는 것으로 "구출됨"을 표현하므로,
// 이 뷰는 stage.cages(고정 목록)와 state.rescued를 대조해 그린다.
//
// 구출은 세 박자다:
//   ① 잠김  — 창살 스틸(tex.closed) + 가벼운 상하 흔들림. 흔들림은 코드가 만든다.
//   ② 해제  — 자물쇠가 떨어지고 창살이 열린다. **이미지 시퀀스**(tex.open)를 한 번 재생한다.
//   ③ 낙하  — 동물이 우루루 쏟아진다. 바닥에 가까워질수록 **커진다** —
//             카메라 쪽으로 다가온다는 뜻이다. 지금은 한 장을 여러 마리로 쓰는 목업이고,
//             아트가 오면 여기가 **동물 시퀀스 묶음** 자리다.
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { makeSequence, type SequenceView } from "../sequence";
import { cellToScreen, HEX_SIZE, CENTER_H } from "./geom";
import type { Cage, RunState } from "../../engine/hex/types";
import { cageProgress } from "../../engine/hex/cageFaces";

export interface CageTextures {
  /** 잠긴 우리 — 스틸 한 장 */
  closed: Texture | null;
  /** 잠금이 풀리는 순간 — 이미지 시퀀스. 한 장만 넣으면 스틸로 동작한다 */
  open: readonly Texture[];
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
  destroy(): void;
}

// ── 연출 상수 — 한곳에 모아 둔다 ──────────────────────────────
const IDLE_BOB_PX = 1.6;      // 잠김 idle 진폭
const IDLE_BOB_HZ = 0.35;
const UNLOCK_MS = 320;        // 자물쇠가 떨어지고 창살이 열리기까지
const FALL_MS = 900;          // 동물이 바닥에 닿기까지
const ANIMAL_COUNT = 6;       // 우루루 — 한 케이지에서 쏟아지는 마릿수
const ANIMAL_SCALE_NEAR = 0.5; // 출발(멀다)
const ANIMAL_SCALE_FAR = 1.8;  // 바닥(가깝다)
const FLOOR_Y = CENTER_H - 40; // 동물이 사라지는 높이

/** 금 색. 잠금이 버티고 있다는 표시라 창살과 같은 계열로 둔다. */
const CRACK_COLOR = 0xf2f6fb;

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
  /** 아트가 있을 때만: 잠긴 우리 스프라이트. 해제 때 이 자리를 시퀀스가 덮는다 */
  closedSprite: Sprite | null;
  size: number;
}

function makeAnimalView(cage: Cage, tex: CageTextures, w: number, h: number): Container {
  const frames = tex.animals[cage.animalId] ?? [];
  if (frames.length > 0) {
    // 동물은 갇혀 있는 동안에도 살아 있어야 한다 — 시퀀스를 계속 돌린다
    const seq = makeSequence(frames, w, h);
    if (seq) {
      void seq.play({ fps: 12, loop: true });
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
  let closedSprite: Sprite | null = null;
  if (tex.closed) {
    // 아트가 있으면: 그늘 → 동물 → 창살 한 장(안쪽이 비어 있어 동물이 비쳐 보인다)
    box.addChild(new Graphics().poly(flatHexPoints(size - 1)).fill(CAGE_DARK));
    box.addChild(makeAnimalView(cage, tex, w * 0.5, h * 0.5));

    // 덩어리 전체를 덮는 큰 flat-top 육각 한 장 — 가로:세로 = 2 : √3
    closedSprite = new Sprite(tex.closed);
    closedSprite.anchor.set(0.5);
    closedSprite.width = w;
    closedSprite.height = h;
    box.addChild(closedSprite);
    return { box, bars: null, lock: null, closedSprite, size };
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

  return { box, bars, lock, closedSprite, size };
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

  /** 잠김 idle — 아트가 오면 이 자리가 idle 시퀀스로 바뀐다.
   *  지금은 아주 가벼운 상하 흔들림 목업이다. 연출 중인 케이지는 건드리지 않는다. */
  function startIdle(): void {
    if (idleRaf !== 0) return;
    const tick = (): void => {
      idleRaf = 0;
      if (root.destroyed || bodies.size === 0) return;
      const t = performance.now() / 1000;
      for (const [id, e] of bodies) {
        if (animating.has(id) || e.body.box.destroyed) continue;
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

  /** ② 해제 — 자물쇠가 떨어지고 창살이 열린다. 열림 시퀀스를 한 번 재생한다. */
  async function playUnlock(entry: Entry): Promise<void> {
    const { box, bars, lock, closedSprite, size } = entry.body;

    // 열림 시퀀스가 있으면 잠긴 우리를 덮고 그 자리에서 재생한다.
    // 잠긴 스프라이트를 지우지 않고 덮는 이유는, 시퀀스 첫 프레임이 자리를 잡기 전
    // 한 프레임이라도 빈 칸이 보이면 우리가 사라진 것처럼 깜빡이기 때문이다.
    let seq: SequenceView | null = null;
    if (textures.open.length > 0 && !box.destroyed) {
      seq = makeSequence(textures.open, 2 * size, Math.sqrt(3) * size);
      if (seq) {
        box.addChild(seq.root);
        void seq.play({ fps: Math.max(8, Math.round((textures.open.length * 1000) / UNLOCK_MS)) });
      }
    }
    if (closedSprite && seq && !closedSprite.destroyed) closedSprite.visible = false;

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
      box.scale.set(1 + 0.06 * Math.sin(Math.PI * t)); // 덜컹
      return true;
    });
  }

  /** ③ 낙하 — 동물이 우루루 쏟아진다. 바닥에 가까워질수록 커진다. */
  async function playFall(cage: Cage, entry: Entry): Promise<void> {
    const { box, size } = entry.body;
    const w = 2 * size;
    const h = Math.sqrt(3) * size;
    const originX = box.x;
    const originY = entry.baseY;

    interface Faller { view: Container; vx: number; delay: number; spin: number }
    const fallers: Faller[] = [];
    for (let i = 0; i < ANIMAL_COUNT; i += 1) {
      const view = makeAnimalView(cage, textures, w * 0.42, h * 0.42);
      view.x = originX;
      view.y = originY;
      view.alpha = 0;
      fallLayer.addChild(view);
      // 부채꼴로 흩어진다 — 가운데는 곧게, 바깥쪽은 크게 벌어진다
      const spread = (i / (ANIMAL_COUNT - 1) - 0.5) * 2; // -1 … 1
      fallers.push({
        view,
        vx: spread * 90 + (Math.random() - 0.5) * 24,
        delay: i * 0.06,
        spin: spread * 2.2,
      });
    }

    const travel = FLOOR_Y - originY;
    try {
      await animate(FALL_MS, (t) => {
        if (root.destroyed) return false;
        // 케이지 몸체는 동물이 나오는 동안 사그라든다
        if (!box.destroyed) box.alpha = Math.max(0, 1 - t * 1.6);
        for (const f of fallers) {
          if (f.view.destroyed) continue;
          // delay를 뺀 자기 시간. 아직 안 나온 놈은 투명하게 대기한다
          const p = Math.max(0, Math.min(1, (t - f.delay) / (1 - f.delay)));
          if (p <= 0) continue;
          f.view.alpha = Math.min(1, p * 4);
          // 처음엔 살짝 튀어 올랐다가 중력으로 떨어진다
          const rise = -26 * Math.sin(Math.PI * Math.min(1, p * 1.6)) * 0.5;
          f.view.x = originX + f.vx * p;
          f.view.y = originY + travel * p * p + rise;
          f.view.rotation = f.spin * p;
          // 바닥에 가까워질수록 커진다 — 카메라 쪽으로 다가온다
          f.view.scale.set(ANIMAL_SCALE_NEAR + (ANIMAL_SCALE_FAR - ANIMAL_SCALE_NEAR) * p * p);
          if (p > 0.82) f.view.alpha = Math.max(0, (1 - p) / 0.18);
        }
        return true;
      });
    } finally {
      for (const f of fallers) if (!f.view.destroyed) f.view.destroy({ children: true });
    }
  }

  return {
    root,

    sync(state: RunState): void {
      for (const cage of state.stage.cages) {
        const rescued = state.rescued.includes(cage.animalId);
        const existing = bodies.get(cage.id);

        if (rescued) {
          // 구출 연출이 도는 중이면 건드리지 않는다 — playRescue가 끝내고 스스로 치운다
          if (animating.has(cage.id)) continue;
          if (existing) {
            existing.body.box.destroy({ children: true });
            existing.crack.destroy();
            bodies.delete(cage.id);
          }
          continue;
        }
        if (existing) {
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
      for (const cage of state.stage.cages) {
        const e = bodies.get(cage.id);
        if (e) syncCracks(state, cage, e);
      }
      if (bodies.size > 0) startIdle();
    },

    async playRescue(cage: Cage): Promise<void> {
      const entry = bodies.get(cage.id);
      if (!entry) return;

      animating.add(cage.id);
      try {
        await playUnlock(entry);
        await playFall(cage, entry);
      } finally {
        // 연출이 끝났으니 스스로 치운다 — 이후 sync가 다시 그리지 않는다
        animating.delete(cage.id);
        if (!entry.body.box.destroyed) entry.body.box.destroy({ children: true });
        if (!entry.crack.destroyed) entry.crack.destroy();
        bodies.delete(cage.id);
        if (bodies.size === 0) stopIdle();
      }
    },

    destroy(): void {
      stopIdle(); // rAF가 살아 있으면 파괴된 노드를 계속 만진다
      animating.clear();
      for (const e of bodies.values()) {
        if (!e.body.box.destroyed) e.body.box.destroy({ children: true });
        if (!e.crack.destroyed) e.crack.destroy();
      }
      bodies.clear();
      root.destroy({ children: true });
    },
  };
}
