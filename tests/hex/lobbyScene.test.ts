// tests/hex/lobbyScene.test.ts — 로비 배경 영상 고르기.
//
// 이 규칙이 틀리면 화면이 깨지지 않고 **조용히 엉뚱한 장면**이 돈다. 아트가 다
// 올라오기 전에는 눈으로 알아채기도 어렵다. 특히 구출 수가 1씩 늘지 않는다는
// 점(한 판에서 두 마리를 구하면 1 다음이 3)이 함정이다.
import { describe, it, expect } from "vitest";
import { sceneFor, SCENE_KEYS } from "../../src/data/lobbyScene";
import { ANIMALS } from "../../src/data/animals";

/** 올라온 파일 목록을 흉내 낸다. */
const having = (...keys: string[]) => (k: string): boolean => keys.includes(k);
const all = (): boolean => true;
const none = (): boolean => false;

const [k1, k2, k3, k4, k5, k6] = SCENE_KEYS;

describe("SCENE_KEYS", () => {
  it("동물 6종과 같은 순서다 — 슬롯 id를 그대로 재활용한다", () => {
    expect(SCENE_KEYS).toEqual(ANIMALS.map((a) => a.id));
    expect(SCENE_KEYS).toHaveLength(6);
  });
});

describe("sceneFor", () => {
  it("아직 한 마리도 못 구했으면 없다 — 스틸 배경으로 간다", () => {
    expect(sceneFor(0, all)).toBeNull();
  });

  it("구출 수만큼의 장면을 고른다", () => {
    expect(sceneFor(1, all)).toBe(k1);
    expect(sceneFor(3, all)).toBe(k3);
    expect(sceneFor(6, all)).toBe(k6);
  });

  it("구출 수가 1씩 늘지 않아도 된다 — 한 판에 두 마리를 구하면 1 다음이 3이다", () => {
    // stage-01 → 양 하나, stage-02 → 얼룩말·사슴 둘. 2마리 상태는 존재하지 않는다.
    expect(sceneFor(1, all)).toBe(k1);
    expect(sceneFor(3, all)).toBe(k3);
  });

  it("그 자리 파일이 없으면 **이하 중 가장 큰 것**으로 내려간다", () => {
    expect(sceneFor(3, having(k1!, k2!))).toBe(k2);
    expect(sceneFor(3, having(k1!))).toBe(k1);
    expect(sceneFor(6, having(k1!, k4!))).toBe(k4);
  });

  it("위쪽만 올라와 있으면 쓰지 않는다 — 아직 못 구한 동물이 보이면 안 된다", () => {
    expect(sceneFor(2, having(k4!, k5!, k6!))).toBeNull();
    expect(sceneFor(3, having(k4!))).toBeNull();
  });

  it("하나도 안 올라왔으면 없다", () => {
    expect(sceneFor(3, none)).toBeNull();
    expect(sceneFor(6, none)).toBeNull();
  });

  it("구출 수가 장면 수를 넘으면 마지막 장면에 머문다 — 스테이지가 늘어도 안 깨진다", () => {
    expect(sceneFor(7, all)).toBe(k6);
    expect(sceneFor(99, all)).toBe(k6);
  });

  it("이상한 값은 없는 것으로 본다", () => {
    expect(sceneFor(-1, all)).toBeNull();
    expect(sceneFor(Number.NaN, all)).toBeNull();
    expect(sceneFor(Number.POSITIVE_INFINITY, all)).toBeNull();
    expect(sceneFor(2.7, all)).toBe(k2); // 소수는 내림 — 2마리 상태다
  });

  it("키 이름의 동물과 그 자리의 동물은 무관하다", () => {
    // 실제 구출 순서는 양 → 얼룩말·사슴인데 키는 rabbit부터다.
    // 1마리째 장면 키가 sheep이 아니라 rabbit이어야 한다 — 순서가 곧 뜻이다.
    expect(sceneFor(1, all)).toBe("rabbit");
    expect(sceneFor(1, all)).not.toBe("sheep");
  });
});
