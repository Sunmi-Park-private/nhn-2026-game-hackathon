// engine/hex/pushRow.ts — 위에서 새 줄이 내려온다. 이 게임의 실패 조건이다.
//
// 발사 제한을 걷어낸 자리에 시간을 넣는다. 판은 주기적으로 한 칸씩 내려오고,
// 마지막 행에 닿으면 진다. 「몇 발 남았나」가 아니라 「얼마나 버티나」가 난이도가 된다.
//
// 내려오는 것은 타일만이 아니다. **창살도 같이 내려간다** — 그래서 RunState가
// 창살의 현재 자리를 따로 들고 있다(stage.cages는 고정 정의라 쓸 수 없다).
import { key, parseKey } from "./coords";
import { ARMOR_LAYERS } from "./pop";
import type { Axial, Cage, Cell, RunState, Tier } from "./types";

/**
 * 이번 밀기의 이동 델타. **밀 때마다 좌우로 번갈아 간다.**
 *
 * 축좌표에서 화면 x는 `√3·size·(q + r/2)`다. 그래서 `r`만 1 늘리면 판이
 * **반 칸 오른쪽으로** 간다 — 예전 코드가 그랬고, 밀 때마다 반 칸씩 **누적**돼
 * 스무 줄쯤 내려오면 판이 우리 오른쪽 벽에 몰렸다.
 *
 * 두 델타 모두 육각 이웃 방향이라 어느 쪽이든 **격자 강체 이동**이다. 인접 관계,
 * 창살 7칸의 육각 모양, 둘레 5면 진행도가 전부 그대로 보존된다 — 오프셋 열을
 * 보존하는 방식(열 번호 고정)은 행 패리티가 뒤집혀 이 셋이 다 깨진다.
 *
 * | 밀기 | 델타 | 화면 x |
 * |---|---|---|
 * | 짝수 번째 | `{q: 0, r: +1}`  | +반 칸 |
 * | 홀수 번째 | `{q: -1, r: +1}` | −반 칸 |
 *
 * 두 번이면 정확히 제자리로 돌아온다. 누적 드리프트가 0이다.
 */
export function pushDelta(pushes: number): Axial {
  return pushes % 2 === 0 ? { q: 0, r: 1 } : { q: -1, r: 1 };
}

/**
 * 이번에 깔 천장 줄의 q 시작값.
 *
 * 새 줄은 언제나 짝수 행(r=0)에 생기므로 q가 정수다. 그런데 **다음 밀기가 왼쪽이면**
 * 이 줄이 그때 반 칸 왼쪽으로 밀려 우리 밖으로 나간다. 그래서 다음 밀기가 왼쪽일 때는
 * 한 칸 오른쪽에서 시작해 미리 상쇄한다.
 *
 * 결과적으로 모든 줄이 태어난 시점과 무관하게 `x ∈ [0, COLS]`칸 안에서만 논다 —
 * `geom.CELL_W`가 폭을 COLS+1로 잡는 근거다.
 */
export function spawnShift(pushes: number): number {
  return pushDelta(pushes + 1).q === -1 ? 1 : 0;
}

/** 셀 하나를 델타만큼 옮긴다. */
function shifted(k: string, d: Axial): string {
  const a = parseKey(k);
  return key({ q: a.q + d.q, r: a.r + d.r });
}

/**
 * 실패 행 — 여기 닿으면 진다. 판의 마지막 행이다.
 *
 * 이 행에 무언가 놓인 순간이 곧 패배이므로, 그 전까지 점유 칸의 r은 항상
 * `rows - 2` 이하다. 따라서 한 칸 밀어도 절대 보드 밖으로 나가지 않는다.
 */
export function failRow(state: RunState): number {
  return state.stage.rows - 1;
}

/** 실패 행에 닿은 칸이 있는가. */
export function hasReachedFailRow(state: RunState): boolean {
  for (const k of state.cells.keys()) {
    if (parseKey(k).r >= failRow(state)) return true;
  }
  return false;
}

/** 새 줄에 깔 색 하나. `rand`는 [0,1)을 돌려준다 — 테스트가 값을 지정할 수 있게 주입받는다. */
function pickFromPalette(palette: Tier[], rand: () => number): Tier {
  if (palette.length === 0) return 0;
  const i = Math.min(palette.length - 1, Math.floor(rand() * palette.length));
  return palette[i]!;
}

/**
 * 판을 한 칸 내리고 천장에 새 줄을 깐다.
 *
 * 이미 실패 행에 닿아 있으면 아무것도 하지 않는다 — 판이 밖으로 밀려나지 않게 하는
 * 안전장치다. 호출부는 `hasReachedFailRow`로 먼저 판정하고 부르는 것이 정상 경로다.
 *
 * 새 줄은 `cols`칸을 빈틈없이 채운다. 한 칸이라도 비우면 그 열이 천장과 끊겨
 * 아래 덩어리가 앵커를 잃고 통째로 떨어진다 — 배치 불변식 S1(연결 하나)이 깨진다.
 */
export function pushRow(state: RunState, rand: () => number = Math.random): boolean {
  if (hasReachedFailRow(state)) return false;

  const d = pushDelta(state.pushes);

  // 아래에서부터 옮긴다 — 위에서부터 하면 방금 옮긴 칸을 덮어쓴다.
  const entries = [...state.cells.entries()].sort((a, b) => parseKey(b[0]).r - parseKey(a[0]).r);
  const next = new Map<string, Cell>();
  for (const [k, cell] of entries) next.set(shifted(k, d), cell);

  // 창살도 같이 내려간다. 안 내리면 창살만 제자리에 남아 둘레와 어긋난다.
  // 타일과 **같은 델타**라야 한다 — 다르면 창살이 둘레에서 미끄러진다.
  state.cages = state.cages.map(
    (c): Cage => ({ ...c, cells: c.cells.map((a) => ({ q: a.q + d.q, r: a.r + d.r })) }),
  );

  // 새 천장 — r = 0이므로 오프셋 열 c의 축좌표는 q = c다. 여기에 다음 밀기 방향을
  // 상쇄하는 spawnShift를 더한다.
  //
  // 말발굽은 **여기서만** 얹는다. 시작 배치에 두면 창살 둘레에 걸려 비용이 세 배가
  // 되면서 못 깨는 판이 나올 수 있다(배치 불변식 S4 참조). 내려오는 줄에만 두면
  // 판이 계속 움직이므로 막히지 않는다.
  const q0 = spawnShift(state.pushes);
  const chance = Math.min(1, Math.max(0, state.stage.armorChance));
  for (let c = 0; c < state.stage.cols; c += 1) {
    const tier = pickFromPalette(state.palette, rand);
    const armored = chance > 0 && rand() < chance;
    next.set(
      key({ q: q0 + c, r: 0 }),
      armored ? { kind: "tile", tier, armor: ARMOR_LAYERS } : { kind: "tile", tier },
    );
  }

  state.cells = next;
  state.pushes += 1;
  return true;
}
