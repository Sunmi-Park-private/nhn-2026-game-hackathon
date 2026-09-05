// tests/hex/shotSnap.test.ts — 스냅 칸은 반드시 판에 붙어 있어야 한다.
//
// QA 실측: 벽 근처로 쏘면 발사체가 홀수 행의 「보드 밖 반 칸」(inBounds가 거르는 칸)을
// 지나는데, simulateShot이 그 칸을 통째로 건너뛰어 마지막 빈 칸이 충돌 칸과
// 이웃이 아니게 됐다. 그 자리에 붙은 타일은 즉시 낙하 판정을 받아 사라졌다 —
// 「쏜 타일이 없어진다」로 보였다.
import { describe, it, expect } from "vitest";
import { createRun, fireAt } from "../../src/engine/hex/stageRun";
import { pushRow } from "../../src/engine/hex/pushRow";
import { simulateShot } from "../../src/engine/hex/shot";
import { key, neighbors } from "../../src/engine/hex/coords";
import { stages } from "../../src/data/stages";
import { BOARD, launchOriginLocal } from "../../src/ui/hex/geom";

const fixed = (): number => 0.3;

describe("스냅 칸은 점유 칸과 이웃이다", () => {
  it("실측 재현 — 1판을 한 줄 내린 뒤 0.4rad·파워 0.5 발은 붙자마자 떨어지지 않는다", () => {
    const st = createRun(stages[0]!, fixed);
    pushRow(st, fixed);
    const { snap } = simulateShot(st.cells, BOARD, launchOriginLocal(), 0.4, 0.5);
    expect(snap).not.toBeNull();
    const touching = neighbors(snap!).some((n) => st.cells.has(key(n)));
    expect(touching).toBe(true);
  });

  it("모든 판·위상·각도·파워에서 쏜 타일이 그 자리에서 사라지는 일이 없다", () => {
    const bad: string[] = [];
    for (const stage of stages) {
      for (let pushes = 0; pushes < 4; pushes += 1) {
        for (let ai = -50; ai <= 50; ai += 1) {
          for (const power of [0, 0.15, 0.3, 0.5, 0.75, 1]) {
            const st = createRun(stage, fixed);
            for (let i = 0; i < pushes; i += 1) pushRow(st, fixed);
            const angle = (ai / 50) * 1.25;
            const out = fireAt(st, BOARD, launchOriginLocal(), angle, power, fixed);
            const s = out.snapped;
            if (s && out.dropped.some((d) => d.q === s.q && d.r === s.r)) {
              bad.push(`${stage.id} pushes=${pushes} angle=${angle.toFixed(2)} power=${power}`);
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
