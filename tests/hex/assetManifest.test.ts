// tests/hex/assetManifest.test.ts — 매니페스트와 에디터 슬롯이 어긋나지 않는지.
//
// 아트가 아직 한 장도 없어 화면으로는 이 어긋남이 안 보인다. 동물 id가 하나만
// 틀려도 그 동물만 조용히 폴백으로 남으므로, 여기서 잡는다.
import { describe, it, expect } from "vitest";
import { hexAssetPaths, lobbyFriendAssetPaths } from "../../src/data/hexAssets";
import { uiAreas, uiUploads } from "../../src/data/uiLayout";
import { ANIMALS } from "../../src/data/animals";

const ids = ANIMALS.map((a) => a.id);
const cap = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`;

describe("창살 에셋", () => {
  it("잠금은 동물마다 프레임 목록이다", () => {
    expect(Object.keys(hexAssetPaths.cageLocked).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(hexAssetPaths.cageLocked[id]!.length).toBeGreaterThan(0);
  });

  it("해제는 동물마다 스틸 한 장이다", () => {
    expect(Object.keys(hexAssetPaths.cageOpen).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(typeof hexAssetPaths.cageOpen[id]).toBe("string");
  });

  it("에디터의 잠금 슬롯만 시퀀스로 받는다", () => {
    for (const id of ids) {
      expect(uiUploads.find((u) => u.asset === `hex.cageLocked.${id}`)?.seq).toBe(true);
      expect(uiUploads.find((u) => u.asset === `hex.cageOpen.${id}`)?.seq).toBe(false);
    }
  });
});

describe("게임 에셋 업로드 목록", () => {
  it("모든 항목이 묶음에 속한다", () => {
    for (const u of uiUploads) expect(u.group, u.asset).toBeTruthy();
  });

  it("같은 묶음이 목록에서 흩어지지 않는다 — 구분선이 두 번 그어진다", () => {
    const seen: string[] = [];
    for (const u of uiUploads) {
      if (seen[seen.length - 1] !== u.group) seen.push(u.group!);
    }
    expect(seen).toEqual([...new Set(seen)]);
  });
});

describe("로비 동물 친구", () => {
  it("동물마다 에셋 경로가 있다", () => {
    expect(Object.keys(lobbyFriendAssetPaths).sort()).toEqual([...ids].sort());
  });

  it("동물마다 로비 슬롯이 있고 그 동물의 에셋을 가리킨다", () => {
    const lobby = uiAreas.find((a) => a.id === "lobby");
    expect(lobby).toBeDefined();
    for (const id of ids) {
      const s = lobby!.slots.find((x) => x.id === `friend${cap(id)}`);
      expect(s, id).toBeDefined();
      expect(s!.asset).toBe(`lobby.friends.${id}`);
    }
  });
});
