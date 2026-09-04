// engine/profile.ts — 스테이지를 넘나들며 누적되는 진행 상태. 순수 TS — 저장소를 주입받는다.
//
// 한 판(RunState)은 스테이지 하나로 끝나지만, 구출한 동물과 말굽은 판을 넘어 쌓인다.
// 로비가 보여주는 것이 이 값이다.

export interface Profile {
  /** 구출한 동물 id — 중복 없이, 구출한 순서대로 */
  rescued: string[];
  /** 누적 말굽 */
  horseshoes: number;
  /** 다음에 도전할 스테이지 인덱스 */
  stageIndex: number;
}

export function emptyProfile(): Profile {
  return { rescued: [], horseshoes: 0, stageIndex: 0 };
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
  return { rescued: next, horseshoes: p.horseshoes + horseshoes, stageIndex: p.stageIndex + 1 };
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
    return { rescued, horseshoes, stageIndex };
  } catch {
    return emptyProfile();
  }
}

export function serializeProfile(p: Profile): string {
  return JSON.stringify(p);
}
