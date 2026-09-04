// data/stages/index.ts — 스테이지 목록. JSON은 로드 시점에 검증한다(규약 3조).
import { parseStage } from "../../engine/hex/stageLoader";
import type { StageDef } from "../../engine/hex/types";
import stage01 from "./stage-01.json";
import stage02 from "./stage-02.json";

export const stages: StageDef[] = [stage01, stage02].map(parseStage);

export function stageAt(index: number): StageDef | undefined {
  return stages[index];
}
