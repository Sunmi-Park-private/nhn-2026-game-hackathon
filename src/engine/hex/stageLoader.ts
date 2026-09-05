// engine/hex/stageLoader.ts — 스테이지 JSON 런타임 검증.
// 규약 3조: 새 JSON은 as unknown as로 받지 않는다. 디자이너 오투입을
// 런타임이 아니라 로드 시점에 잡는다.
import { key, inBounds } from "./coords";
import type { Axial, Cage, StageDef, Tier } from "./types";

function fail(msg: string): never {
  throw new Error(`스테이지 정의 오류: ${msg}`);
}

function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${what}가 객체가 아니다`);
  return v as Record<string, unknown>;
}

function asString(v: unknown, what: string): string {
  if (typeof v !== "string" || v.length === 0) fail(`${what}가 비어 있거나 문자열이 아니다`);
  return v;
}

function asInt(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${what}가 정수가 아니다`);
  return v;
}

function asNumber(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${what}가 유한한 수가 아니다`);
  return v;
}

function asArray(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) fail(`${what}가 배열이 아니다`);
  return v;
}

function asAxial(v: unknown, what: string): Axial {
  const o = asRecord(v, what);
  return { q: asInt(o.q, `${what}.q`), r: asInt(o.r, `${what}.r`) };
}

function asTier(v: unknown, what: string): Tier {
  const n = asInt(v, `${what}.tier`);
  if (n < 0 || n > 5) fail(`${what}.tier가 0~5 범위를 벗어났다 (${n})`);
  return n as Tier;
}

export function parseStage(raw: unknown): StageDef {
  const o = asRecord(raw, "스테이지");

  const id = asString(o.id, "id");
  const cols = asInt(o.cols, "cols");
  const rows = asInt(o.rows, "rows");
  const objective = asInt(o.objective, "objective");
  const pushSeconds = asInt(o.pushSeconds, "pushSeconds");
  const armorChance = o.armorChance === undefined ? 0 : asNumber(o.armorChance, "armorChance");

  if (cols <= 0 || rows <= 0) fail("cols/rows는 1 이상이어야 한다");
  if (pushSeconds <= 0) fail("pushSeconds는 1 이상이어야 한다");
  if (armorChance < 0 || armorChance > 1) fail(`armorChance는 0~1이어야 한다 (${armorChance})`);

  const occupied = new Map<string, string>();
  const claim = (a: Axial, what: string): void => {
    if (!inBounds(a, cols, rows)) fail(`${what}가 보드 범위를 벗어났다 (q=${a.q}, r=${a.r})`);
    const k = key(a);
    const prev = occupied.get(k);
    if (prev !== undefined) fail(`${what}가 ${prev}와 자리가 겹친다 (q=${a.q}, r=${a.r})`);
    occupied.set(k, what);
  };

  const cages: Cage[] = asArray(o.cages, "cages").map((c, i) => {
    const co = asRecord(c, `cages[${i}]`);
    const cells = asArray(co.cells, `cages[${i}].cells`);
    if (cells.length === 0) fail(`cages[${i}].cells가 비어 있다`);
    const parsed = cells.map((cell, j) => asAxial(cell, `cages[${i}].cells[${j}]`));
    for (const a of parsed) claim(a, `cages[${i}]`);
    return {
      id: asString(co.id, `cages[${i}].id`),
      animalId: asString(co.animalId, `cages[${i}].animalId`),
      cells: parsed,
    };
  });

  if (objective < 0 || objective > cages.length) {
    fail(`objective(${objective})가 케이지 수(${cages.length})를 넘는다`);
  }

  const tiles = asArray(o.tiles, "tiles").map((t, i) => {
    const to = asRecord(t, `tiles[${i}]`);
    const at = asAxial(to.at, `tiles[${i}].at`);
    claim(at, `tiles[${i}]`);
    return { at, tier: asTier(to.tier, `tiles[${i}]`) };
  });

  const horseshoes = asArray(o.horseshoes, "horseshoes").map((h, i) => {
    const a = asAxial(h, `horseshoes[${i}]`);
    claim(a, `horseshoes[${i}]`);
    return a;
  });

  return { id, cols, rows, objective, pushSeconds, armorChance, cages, tiles, horseshoes };
}
