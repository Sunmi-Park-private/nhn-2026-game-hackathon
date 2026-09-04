// engine/hex/nextTile.ts — 다음 발사체 색을 판에서 뽑는다.
//
// 발사체를 항상 빨강으로 고정하면 상위 색을 깨는 비용이 3의 거듭제곱으로 늘어난다
// (노랑 1개 = 빨강 3개, 초록 1개 = 빨강 9개 … 황금 1개 = 빨강 243개).
// 스테이지의 발사 제한이 20~25발이므로 판에 놓인 초록 이상은 사실상 손댈 수 없었고,
// 케이지 앞을 비우는 유일한 수단인 합체가 성립하지 않아 구출 자체가 막혔다.
//
// 그래서 버블 슈터의 표준을 따른다 — **판에 남아 있는 색 중에서만** 뽑는다.
// 판에 없는 색은 나오지 않으므로 쓸모없는 탄이 없고, 어떤 색이든 두 발이면 깰 수 있다.
import type { Cell, Tier } from "./types";

/** 낮은 티어일수록 자주 나온다. 오름차순 i번째 티어의 가중치 = 1/2^i.
 *  네 색이 깔린 판이면 대략 53 / 27 / 13 / 7 %.
 *  빨강이 흔해야 판을 채워 올릴 수 있고, 상위 색도 두 발이면 모이는 비율이다. */
const FALLOFF = 0.5;

/** 판에 놓인 타일 티어 목록(오름차순, 중복 제거). 말굽·케이지는 세지 않는다. */
export function presentTiers(cells: Map<string, Cell>): Tier[] {
  const seen = new Set<Tier>();
  for (const cell of cells.values()) {
    if (cell.kind === "tile") seen.add(cell.tier);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * 다음 발사체의 티어를 고른다.
 *
 * `rand`는 [0, 1)을 돌려주는 함수다 — 테스트가 값을 지정할 수 있도록 주입받는다.
 * 판에 타일이 하나도 없으면(전부 걷어낸 직후) 최하위 티어로 돌아간다.
 */
export function pickNext(cells: Map<string, Cell>, rand: () => number): Tier {
  const tiers = presentTiers(cells);
  if (tiers.length === 0) return 0;

  const weights = tiers.map((_, i) => FALLOFF ** i);
  const total = weights.reduce((a, b) => a + b, 0);
  // rand()가 1에 아주 가까울 때 아래 루프가 빠져나가는 경우를 마지막 원소로 받는다
  let roll = rand() * total;
  for (let i = 0; i < tiers.length; i += 1) {
    roll -= weights[i]!;
    if (roll < 0) return tiers[i]!;
  }
  return tiers[tiers.length - 1]!;
}
