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

  it("좌표를 건드리지 않았다 — 하단 4칸 간격이 아트와 맞춰져 있다", () => {
    const nav = uiAreas.find((a) => a.id === "lobby")!.slots.find((s) => s.id === "navRace")!;
    expect([nav.x, nav.y, nav.w, nav.h]).toEqual([122, 738, 96, 50]);
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
