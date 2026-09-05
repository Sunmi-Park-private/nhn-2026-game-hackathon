// engine/hex/pushRow.ts — 위에서 새 줄이 내려온다. 이 게임의 실패 조건이다.
//
// 발사 제한을 걷어낸 자리에 시간을 넣는다. 판은 주기적으로 한 칸씩 내려오고,
// 마지막 행에 닿으면 진다. 「몇 발 남았나」가 아니라 「얼마나 버티나」가 난이도가 된다.
//
// 내려오는 것은 타일만이 아니다. **창살도 같이 내려간다** — 그래서 RunState가
// 창살의 현재 자리를 따로 들고 있다(stage.cages는 고정 정의라 쓸 수 없다).
import { key, parseKey } from "./coords";
import { ARMOR_LAYERS } from "./pop";
import type { Cage, Cell, RunState, Tier } from "./types";

/** 셀 하나를 한 칸 아래로. */
function shifted(k: string): string {
  const a = parseKey(k);
  return key({ q: a.q, r: a.r + 1 });
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

  // 아래에서부터 옮긴다 — 위에서부터 하면 방금 옮긴 칸을 덮어쓴다.
  const entries = [...state.cells.entries()].sort((a, b) => parseKey(b[0]).r - parseKey(a[0]).r);
  const next = new Map<string, Cell>();
  for (const [k, cell] of entries) next.set(shifted(k), cell);

  // 창살도 같이 내려간다. 안 내리면 창살만 제자리에 남아 둘레와 어긋난다.
  state.cages = state.cages.map(
    (c): Cage => ({ ...c, cells: c.cells.map((a) => ({ q: a.q, r: a.r + 1 })) }),
  );

  // 새 천장 — 오프셋 열 c의 축좌표는 q = c - floor(r/2)이고 여기서는 r = 0이다.
  //
  // 말발굽은 **여기서만** 얹는다. 시작 배치에 두면 창살 둘레에 걸려 비용이 세 배가
  // 되면서 못 깨는 판이 나올 수 있다(배치 불변식 S4 참조). 내려오는 줄에만 두면
  // 판이 계속 움직이므로 막히지 않는다.
  const chance = Math.min(1, Math.max(0, state.stage.armorChance));
  for (let c = 0; c < state.stage.cols; c += 1) {
    const tier = pickFromPalette(state.palette, rand);
    const armored = chance > 0 && rand() < chance;
    next.set(
      key({ q: c, r: 0 }),
      armored ? { kind: "tile", tier, armor: ARMOR_LAYERS } : { kind: "tile", tier },
    );
  }

  state.cells = next;
  state.pushes += 1;
  return true;
}
