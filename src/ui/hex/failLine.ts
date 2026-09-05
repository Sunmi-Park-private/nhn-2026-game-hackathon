// ui/hex/failLine.ts — 바닥 눈금. 판이 여기 닿으면 진다.
//
// 실패 조건이 「남은 발사」에서 「판이 바닥에 닿았나」로 바뀌면서, 위험이 숫자가
// 아니라 **거리**가 됐다. 거리는 눈으로 재는 것이 맞다 — 카운터를 읽는 대신
// 판과 선 사이가 얼마나 남았는지를 본다.
import { Container, Graphics } from "pixi.js";
import { FIELD_X, FIELD_W, HEX_SIZE, ROW_H, ORIGIN } from "./geom";

/** 눈금 한 칸의 길이와 간격. 실선이 아니라 눈금이라야 「경계선」으로 읽힌다. */
const TICK = 9;
const GAP = 7;
/** 이 줄 수 안으로 들어오면 경고로 바꾼다. */
const WARN_ROWS = 3;

const SAFE = 0xd9c9a8;
const WARN = 0xe6392f;

export interface FailLine {
  root: Container;
  /** 점유 칸 중 **가장 아래** 행. 없으면 null. */
  sync(lowestRow: number | null): void;
  /** 경고 상태의 깜빡임. 매 프레임 부른다. */
  tick(nowMs: number): void;
  destroy(): void;
}

/**
 * 실패 행의 **위쪽 변**에 눈금을 놓는다.
 *
 * 셀 중심이 아니라 변에 놓는 이유는, 타일이 그 행에 놓이는 순간 선을 **덮어야**
 * 하기 때문이다. 중심에 그으면 이미 걸친 뒤에야 선이 보인다.
 */
export function createFailLine(failRow: number): FailLine {
  const root = new Container();
  const g = new Graphics();
  root.addChild(g);

  const y = ORIGIN.y + ROW_H * failRow - HEX_SIZE;
  let warning = false;

  function draw(color: number, alpha: number): void {
    g.clear();
    for (let x = FIELD_X; x < FIELD_X + FIELD_W; x += TICK + GAP) {
      const w = Math.min(TICK, FIELD_X + FIELD_W - x);
      g.rect(x, y - 1.5, w, 3).fill({ color, alpha });
    }
  }
  draw(SAFE, 0.55);

  return {
    root,

    sync(lowestRow: number | null): void {
      const near = lowestRow !== null && lowestRow >= failRow - WARN_ROWS;
      if (near === warning) return;
      warning = near;
      if (!warning) draw(SAFE, 0.55);
    },

    tick(nowMs: number): void {
      if (!warning) return;
      // 깜빡임은 시간 함수로 그린다 — 상태를 들고 있으면 일시정지에서 어긋난다.
      const pulse = 0.5 + 0.5 * Math.sin((nowMs / 1000) * Math.PI * 2 * 2.4);
      draw(WARN, 0.45 + 0.45 * pulse);
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
