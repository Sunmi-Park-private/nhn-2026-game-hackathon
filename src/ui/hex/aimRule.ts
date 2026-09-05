// ui/hex/aimRule.ts — 「첫 반사가 판 하단 1/3이면 쏘지 못한다」 한 조각.
//
// 왜 있나: 조준 한계가 72°라 거의 눕혀 쏠 수 있었다. 그러면 첫 반사가 말 바로 위에서
// 일어나고 발사체가 판을 여덟 번 넘게 왕복한다 — 조준선이 얇은 지그재그로 화면을
// 뒤덮어 어디로 가는지 읽을 수 없었다(본선 QA).
//
// 각도 상한을 줄이는 방법도 있었지만 그러면 화면 반대편을 크게 도는 뱅크 샷이
// 통째로 죽는다. 그래서 **각도는 그대로 두고 첫 반사 위치로만 막는다.**
// 두 번째 반사부터는 어디서 일어나든 상관없다 — 규칙은 첫 반사 하나뿐이다.
//
// Pixi를 모른다. 궤적을 받아 판정만 한다 — 그래서 헤드리스로 테스트된다.
import { FIELD_TOP, HEX_SIZE, LAUNCH_Y, ORIGIN } from "./geom";

/** 막는 띠의 두께 — 판 세로 길이의 몫. 아래에서부터 이만큼이 첫 반사 금지 구역이다. */
export const BLOCKED_BAND = 1 / 3;

/** 판 위끝(천장 육각의 위 변)의 엔진 좌표 y. */
const TOP_Y = FIELD_TOP - ORIGIN.y - HEX_SIZE;

/** 발사 지점의 엔진 좌표 y — 판의 아래끝으로 본다. */
const BOTTOM_Y = LAUNCH_Y - ORIGIN.y;

/**
 * 첫 반사가 이 y보다 **아래면** 막는다(엔진 좌표계, y는 아래로 증가).
 * 판 세로를 셋으로 나눈 아래 칸의 윗변이다.
 */
export const FIRST_BOUNCE_LIMIT_Y = BOTTOM_Y - (BOTTOM_Y - TOP_Y) * BLOCKED_BAND;

/**
 * 이 조준으로 쏠 수 없는가.
 *
 * 벽에 한 번도 닿지 않는 발(똑바로 위로 쏘는 것 포함)은 언제나 허용한다 —
 * 막을 「첫 반사」가 없다.
 */
export function aimBlocked(bounces: ReadonlyArray<{ y: number }>): boolean {
  const first = bounces[0];
  return first !== undefined && first.y > FIRST_BOUNCE_LIMIT_Y;
}
