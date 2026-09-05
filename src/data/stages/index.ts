// data/stages/index.ts — 스테이지 목록. JSON은 로드 시점에 검증한다(규약 3조).
//
// 6판의 난이도 곡선은 docs/superpowers/specs/2026-09-05-stage-balance-design.md 를 따른다.
// 배치는 scripts/balance-layout.py 가 불변식(S1~S6)을 만족하도록 생성한 것이고,
// 그 산출물이 docs/superpowers/specs/2026-09-05-stage-layouts.json 이다.
// **샷 수는 아직 잠정이다** — 헤드리스 봇 측정 전이라 덩어리를 씹는 비용과
// 창살 깊이 비용이 빠져 있다.
import { parseStage } from "../../engine/hex/stageLoader";
import type { StageDef } from "../../engine/hex/types";
import stage01 from "./stage-01.json";
import stage02 from "./stage-02.json";
import stage03 from "./stage-03.json";
import stage04 from "./stage-04.json";
import stage05 from "./stage-05.json";
import stage06 from "./stage-06.json";

export const stages: StageDef[] = [stage01, stage02, stage03, stage04, stage05, stage06].map(
  parseStage,
);

export function stageAt(index: number): StageDef | undefined {
  return stages[index];
}
