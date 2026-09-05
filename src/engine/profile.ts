// engine/profile.ts — 스테이지를 넘나들며 누적되는 진행 상태. 순수 TS — 저장소를 주입받는다.
//
// 한 판(RunState)은 스테이지 하나로 끝나지만, 구출한 동물과 말굽은 판을 넘어 쌓인다.
// 로비가 보여주는 것이 이 값이다.

import type { Boosters } from "./hex/types";

export interface Profile {
  /** 구출한 동물 id — 중복 없이, 구출한 순서대로 */
  rescued: string[];
  /** 누적 말굽 */
  horseshoes: number;
  /** 다음에 도전할 스테이지 인덱스 */
  stageIndex: number;
  /** 동물 id → 레이스 최고기록(초). 기록이 없으면 키가 없다 */
  raceBest: Record<string, number>;
  /** 레이스로 번 부스터 재고 — 다음 스테이지 진입 때 실린다 */
  boosters: Boosters;
}

/** 저장소 키. 게임과 치트 패널이 같은 자리를 봐야 해서 한곳에 둔다 —
 *  문자열을 양쪽에 적어 두면 한쪽만 고쳐도 아무도 모른다. */
export const PROFILE_KEY = "redhorserescue.profile";

const noBoosters = (): Boosters => ({ bomb: 0, rainbow: 0, horseshoe: 0 });

export function emptyProfile(): Profile {
  return { rescued: [], horseshoes: 0, stageIndex: 0, raceBest: {}, boosters: noBoosters() };
}

/** 한 판의 결과를 누적한다. 같은 동물을 또 구해도 도감에는 한 번만 남는다. */
export function addClear(p: Profile, rescued: string[], horseshoes: number): Profile {
  const seen = new Set(p.rescued);
  const next = [...p.rescued];
  for (const id of rescued) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  // 레이스 쪽 값은 스테이지 클리어와 무관하다 — 그대로 실어 보낸다
  return {
    rescued: next,
    horseshoes: p.horseshoes + horseshoes,
    stageIndex: p.stageIndex + 1,
    raceBest: p.raceBest,
    boosters: p.boosters,
  };
}

/** 동물 id → 기록(초). 유한한 양수만 남긴다 — 0초는 기록이 될 수 없다. */
function parseRaceBest(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw === null || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[id] = v;
  }
  return out;
}

/** 부스터 재고. 세 칸을 항상 채운다 — 없는 칸이 undefined면 화면이 NaN을 그린다. */
function parseBoosters(raw: unknown): Boosters {
  const o = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  return { bomb: n(o.bomb), rainbow: n(o.rainbow), horseshoe: n(o.horseshoe) };
}

/** 저장된 값을 읽어 온다. 형태가 어긋나면 조용히 빈 프로필로 돌아간다 —
 *  저장 포맷이 바뀌어도 게임이 못 뜨는 일은 없어야 한다. */
export function parseProfile(raw: string | null): Profile {
  if (!raw) return emptyProfile();
  try {
    const o = JSON.parse(raw) as Partial<Profile>;
    const rescued = Array.isArray(o.rescued) ? o.rescued.filter((x): x is string => typeof x === "string") : [];
    const horseshoes = typeof o.horseshoes === "number" && Number.isFinite(o.horseshoes) ? Math.max(0, Math.floor(o.horseshoes)) : 0;
    const stageIndex = typeof o.stageIndex === "number" && Number.isFinite(o.stageIndex) ? Math.max(0, Math.floor(o.stageIndex)) : 0;
    return {
      rescued, horseshoes, stageIndex,
      raceBest: parseRaceBest(o.raceBest),
      boosters: parseBoosters(o.boosters),
    };
  } catch {
    return emptyProfile();
  }
}

export function serializeProfile(p: Profile): string {
  return JSON.stringify(p);
}
