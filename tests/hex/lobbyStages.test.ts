// tests/hex/lobbyStages.test.ts — 로비의 스테이지 1~6 버튼.
//
// QA 요구가 두 줄이었다: 「스테이지1~6 버튼이 있어야 하고, 모두 같은 결과값
// (포지션·스케일)을 갖고 있어야 한다」. 뒤쪽이 눈으로는 안 잡힌다 — 여섯 칸 중
// 하나만 배율이 다르면 그 칸만 살짝 크고, 화면에서는 아트 탓으로 보인다.
// 그래서 「같다」를 여기서 잰다.
//
// 칸 **위치**는 못박지 않는다. 자리는 디자이너가 에디터에서 옮기는 값이고,
// 숫자로 고정하면 옮길 때마다 테스트가 빨개져 결국 좌표가 되돌려진다 —
// 그 되돌림이 이번 QA의 다른 항목(RACE)이 생긴 방식이다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { uiAreas } from "../../src/data/uiLayout";
import { LOBBY_SLOT_IDS } from "../../src/data/hexAssets";
import { stages } from "../../src/data/stages";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "../../src/data/assets.json"), "utf8"),
) as { lobby: Record<string, string> };

const lobby = uiAreas.find((a) => a.id === "lobby")!;
const ids = Array.from({ length: 6 }, (_, i) => `stage${i + 1}`);
const slots = ids.map((id) => lobby.slots.find((s) => s.id === id));

describe("로비 스테이지 1~6 버튼", () => {
  it("여섯 칸이 다 있다 — PLAY 한 칸이던 자리다", () => {
    expect(slots.map((s) => s?.id)).toEqual(ids);
    expect(lobby.slots.map((s) => s.id)).not.toContain("play");
  });

  it("판 수와 버튼 수가 같다 — 판을 늘리면 버튼도 늘어나야 한다", () => {
    expect(stages).toHaveLength(ids.length);
  });

  it("여섯 칸이 같은 크기·같은 배율이다", () => {
    const [first] = slots as NonNullable<(typeof slots)[number]>[];
    for (const s of slots) {
      expect([s!.w, s!.h], s!.id).toEqual([first!.w, first!.h]);
      expect(s!.scale ?? 1, s!.id).toBe(first!.scale ?? 1);
    }
  });

  it("서로 겹치지 않는다 — 겹치면 위 칸이 아래 칸의 탭을 가로챈다", () => {
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const a = slots[i]!, b = slots[j]!;
        const apart =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.id}와 ${b.id}가 겹친다`).toBe(true);
      }
    }
  });

  it("칸마다 제 아트 키를 가리키고 매니페스트에 그 키가 있다", () => {
    for (const s of slots) {
      expect(s!.asset, s!.id).toBe(`lobby.${s!.id}`);
      expect(manifest.lobby[s!.id], s!.id).toBeTruthy();
    }
  });

  it("로더가 여섯 칸을 읽는다 — 슬롯만 있고 로더가 모르면 늘 폴백이다", () => {
    for (const id of ids) expect(LOBBY_SLOT_IDS as readonly string[]).toContain(id);
  });
});
