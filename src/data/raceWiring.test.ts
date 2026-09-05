// 배선 사실 — 화면을 못 띄우는 환경에서도 어긋남이 드러나야 하는 것들.
// 렌더는 테스트하지 않지만, 「어느 슬롯을 어느 에셋에 잇는가」는 데이터라서 검증할 수 있다.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiAreas, uiUploads, uiAudios } from "./uiLayout";
import { LOBBY_SLOT_IDS, AUDIO_SLOT_IDS } from "./hexAssets";
import { raceAssetPaths } from "./raceAssets";
import { RACE_AREAS, RACE_SLOT_IDS } from "../ui/race/raceSlots";
import { ANIMALS } from "./animals";

const manifest = JSON.parse(readFileSync(join(__dirname, "assets.json"), "utf8")) as Record<string, any>;

/** 점 경로로 매니페스트를 판다. hex.tiles.0 처럼 **배열 인덱스**도 지나간다 —
 *  객체만 따라가면 타일 6종이 통째로 「없음」으로 잡힌다. */
const at = (dotted: string): unknown =>
  dotted.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), manifest);

describe("로비 RACE 교체", () => {
  it("navWorld가 어디에도 남아 있지 않다", () => {
    const lobby = uiAreas.find((a) => a.id === "lobby")!;
    expect(lobby.slots.map((s) => s.id)).toContain("navRace");
    expect(lobby.slots.map((s) => s.id)).not.toContain("navWorld");
    expect(LOBBY_SLOT_IDS).toContain("navRace");
    expect(manifest.lobby.navWorld).toBeUndefined();
    expect(manifest.lobby.navRace).toBeTruthy();
  });

  // 예전에는 여기서 [122, 738, 96, 50]을 **숫자로 못박았다.** 그 자리를 디자이너가
  // 에디터에서 옮기면(4칸을 나란히 맞추면서 y와 scale이 함께 바뀐다) 테스트가 빨개졌고,
  // 고치는 사람이 좌표를 옛 값으로 되돌리곤 했다 — 에디터 편집이 조용히 사라지는 경로였다.
  // 못박을 것은 좌표가 아니라 **줄의 성질**이다: RACE는 하단 4칸의 둘째 칸이고,
  // 네 칸은 같은 높이·같은 크기·같은 배율로 고르게 놓인다.
  it("하단 4칸이 한 줄로 고르게 놓이고 RACE가 둘째 칸이다", () => {
    const lobby = uiAreas.find((a) => a.id === "lobby")!;
    const row = ["navHome", "navRace", "navAnimals", "navEvents"]
      .map((id) => lobby.slots.find((s) => s.id === id)!);
    expect(row.every(Boolean)).toBe(true);

    const [first] = row;
    for (const s of row) {
      expect([s.y, s.w, s.h], s.id).toEqual([first!.y, first!.w, first!.h]);
      expect(s.scale ?? 1, s.id).toBe(first!.scale ?? 1);
    }
    // 왼쪽부터 차례로 놓이고 서로 겹치지 않는다. 겹치면 큰 쪽이 탭을 가로챈다 —
    // 실제로 RACE 자리표시가 HOME을 덮고 탭까지 먹은 적이 있다(ui/lobbyScreen.ts).
    // 간격이 정확히 같기까지 요구하지는 않는다. 픽셀 몇 개는 디자이너의 몫이다.
    row.slice(1).forEach((s, i) => {
      const prev = row[i]!;
      expect(s.x, `${prev.id} → ${s.id} 순서가 뒤집혔다`).toBeGreaterThan(prev.x);
      expect(s.x, `${prev.id}와 ${s.id}가 겹친다`).toBeGreaterThanOrEqual(prev.x + prev.w);
    });
    expect(row[1]!.id).toBe("navRace");
  });

  it("worldScreen은 파일로 남되 아무도 import하지 않는다 — 번들에서 빠진다", () => {
    const srcFiles: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".ts")) srcFiles.push(p);
      }
    };
    walk(join(__dirname, ".."));
    const importers = srcFiles.filter(
      (f) => !f.endsWith("worldScreen.ts") && /from "[^"]*worldScreen"/.test(readFileSync(f, "utf8")),
    );
    expect(importers).toEqual([]);
  });
});

describe("레이스 슬롯과 에셋", () => {
  it("코드의 슬롯 목록과 JSON의 세 영역이 정확히 같다", () => {
    for (const area of RACE_AREAS) {
      const inJson = uiAreas.find((a) => a.id === area)!.slots.map((s) => s.id);
      expect([...inJson].sort(), area).toEqual([...RACE_SLOT_IDS[area]].sort());
    }
  });

  it("슬롯이 가리키는 asset 경로가 매니페스트에 실재한다", () => {
    for (const area of uiAreas) {
      for (const s of area.slots) {
        for (const key of [s.asset, s.assetOff]) {
          if (key) expect(at(key), `${area.id}/${s.id} → ${key}`).toBeTruthy();
        }
      }
    }
  });

  it("업로드 목록의 asset 경로도 매니페스트에 실재한다", () => {
    for (const u of [...uiUploads, ...uiAudios]) expect(at(u.asset), u.asset).toBeTruthy();
  });

  it("러너 6종이 도감 동물과 같은 id를 쓴다", () => {
    expect(Object.keys(raceAssetPaths.runners).sort()).toEqual(ANIMALS.map((a) => a.id).sort());
  });

  it("레이스 오디오 6종이 슬롯 목록에 있다", () => {
    for (const id of ["bgmRace", "sfxWhistle", "sfxStep", "sfxRouletteTick", "sfxFinish", "sfxRecord"]) {
      expect(AUDIO_SLOT_IDS).toContain(id);
    }
  });
});
