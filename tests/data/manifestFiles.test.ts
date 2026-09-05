// tests/data/manifestFiles.test.ts — 매니페스트가 가리키는 파일이 **리포에 실제로 있는지**.
//
// 왜 있나: RACE 버튼이 열 번 가까이 「사라졌다」. 코드는 매번 멀쩡했다 —
// 아트를 반입한 커밋(art/editor-inbound-race-cage)이 main에 머지되지 않아,
// main에서 딴 브랜치는 늘 `lobby.navRace → assets/lobby/nav-race.webp`를 가리키면서
// 그 파일이 없는 상태로 시작했다. 없는 경로는 loadTexture가 조용히 null로 접고
// 로비는 갈색 폴백 상자를 그린다 — 화면만 봐서는 「버튼이 없다」로 보인다.
//
// 에디터가 assets.json을 **통째로** 덮어쓰는 것도 같은 결과를 만든다. 디스크가 그
// 사이 바뀌면(브랜치 전환·다른 저장) 오래된 탭의 저장이 최신 항목을 되돌린다.
// 실제로 race.runners.rabbit이 35프레임 배열에서 run-rabbit.png로,
// hex.cageLocked 6종이 프레임 배열에서 단일 png로 되돌아가 있었다.
//
// **불변식**: 매니페스트의 모든 경로는 public/ 아래에 파일이 있다.
// 아직 안 들어온 아트는 PENDING에 **이름을 적어 예외로 둔다** — 목록에 없는 것이
// 비면 실패한다. 아트가 도착하면 그 줄을 지운다. 목록은 줄어들기만 한다.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import manifest from "../../src/data/assets.json";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** 아직 반입되지 않은 자리. 여기 적힌 것만 파일이 없어도 된다.
 *  아트가 오면 지운다 — 늘어나야 할 이유가 있다면 그건 회귀다. */
const PENDING = new Set([
  "hex.cageOpen.rabbit",
  "hex.cageOpen.monkey",
  "hex.cageOpen.deer",
  "hex.cageOpen.sheep",
  "hex.cageOpen.zebra",
  "hex.cageOpen.elephant",
  "hex.animals.elephant",
  "hex.bg.board",
  "hex.bg.panelLeft",
  "hex.bg.panelRight",
  "lobby.stage2",
  "lobby.stage3",
  "lobby.stage4",
  "lobby.stage5",
  "lobby.stage6",
  "video.ending",
  "audio.sfxClear",
  "audio.sfxWhistle",
  "audio.sfxStep",
  "audio.sfxRouletteTick",
  "audio.sfxFinish",
  "audio.sfxRecord",
  "race.bg.finish",
  "race.ui.podium",
  "race.ui.btnRetry",
  "race.ui.btnClose",
  "race.card.on",
  "race.card.off",
  "race.row.first",
  "race.row.rest",
  "race.medal.gold",
  "race.medal.silver",
  "race.medal.bronze",
]);

/** 매니페스트를 훑어 `키 경로 → assets/… 경로` 쌍을 모은다.
 *  프레임 배열은 칸마다 인덱스를 붙인다(hex.cageLocked.rabbit[3]). */
function collect(node: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof node === "string") {
    if (node.startsWith("assets/")) out.push([path, node]);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, `${path}[${i}]`, out));
  } else if (node !== null && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "_note") continue;
      collect(v, path === "" ? k : `${path}.${k}`, out);
    }
  }
}

const entries: Array<[string, string]> = [];
collect(manifest, "", entries);

/** 예외는 칸 하나(hex.tiles[5])로도, 시퀀스 통째(race.runners.deer)로도 적을 수 있다. */
const excused = (key: string): boolean => PENDING.has(key) || PENDING.has(key.replace(/\[\d+\]$/, ""));

describe("매니페스트가 가리키는 파일", () => {
  it("훑을 경로가 실제로 있다 — 파서가 빈 결과를 내면 이 테스트 전체가 무의미하다", () => {
    expect(entries.length).toBeGreaterThan(300);
  });

  it("PENDING 밖의 경로는 public/ 아래에 파일이 있다", () => {
    const missing = entries
      .filter(([key]) => !excused(key))
      .filter(([, p]) => !existsSync(resolve(ROOT, "public", p)))
      .map(([key, p]) => `${key} -> ${p}`);
    expect(missing).toEqual([]);
  });

  it("PENDING에 죽은 줄이 없다 — 아트가 왔는데 예외로 남아 있으면 지운다", () => {
    const stillMissing = new Set<string>();
    for (const [key, p] of entries) {
      if (existsSync(resolve(ROOT, "public", p))) continue;
      stillMissing.add(key);
      stillMissing.add(key.replace(/\[\d+\]$/, ""));
    }
    expect([...PENDING].filter((k) => !stillMissing.has(k)).sort()).toEqual([]);
  });

  it("RACE 버튼 아트가 리포에 있다 — 열 번 사라진 자리다", () => {
    const navRace = (manifest as { lobby: { navRace: string } }).lobby.navRace;
    expect(existsSync(resolve(ROOT, "public", navRace)), navRace).toBe(true);
  });
});
