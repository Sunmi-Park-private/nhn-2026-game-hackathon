// tests/hex/uiLayoutDiff.test.ts — 「내가 읽어 온 뒤로 디스크가 바뀌었나」 판정.
//
// 에디터가 둘(/ui.html과 게임 화면)이고 같은 파일을 본다. 이 판정이 헐거우면
// 저장이 남의 편집을 조용히 덮어쓰고, 빡빡하면 아무것도 안 바뀌었는데
// 매번 「바뀌었다」고 막아 저장을 못 하게 된다.
import { describe, it, expect } from "vitest";
import { sameAreas, type UiArea, type UiSlot } from "../../src/data/uiLayout";

/** 디스크에서 온 JSON은 모르는 필드를 달고 올 수 있다 — 그 경우까지 세운다. */
type SlotLike = UiSlot & { [key: string]: unknown };

const area = (slots: SlotLike[]): UiArea[] => [{ id: "lobby", label: "로비", slots }];

const play = { id: "play", label: "PLAY", x: 140, y: 630, w: 174, h: 54, asset: "lobby.play" };

describe("sameAreas", () => {
  it("같은 값이면 같다", () => {
    expect(sameAreas(area([{ ...play }]), area([{ ...play }]))).toBe(true);
  });

  it("좌표가 하나라도 다르면 다르다", () => {
    expect(sameAreas(area([{ ...play }]), area([{ ...play, x: 111 }]))).toBe(false);
  });

  it("키 순서가 달라도 같다 — 디스크 JSON과 파서를 거친 값은 순서가 다르다", () => {
    const reordered = { h: 54, w: 174, y: 630, x: 140, asset: "lobby.play", label: "PLAY", id: "play" };
    expect(sameAreas(area([{ ...play }]), area([reordered]))).toBe(true);
  });

  it("모르는 잉여 필드는 무시한다 — 저장을 막을 이유가 아니다", () => {
    expect(sameAreas(area([{ ...play }]), area([{ ...play, _메모: "디자이너 주석" }]))).toBe(true);
  });

  it("없는 값과 undefined를 같게 본다", () => {
    expect(sameAreas(area([{ ...play }]), area([{ ...play, scale: undefined }]))).toBe(true);
  });

  it("hidden은 true일 때만 의미가 있다 — false와 없음은 같다", () => {
    expect(sameAreas(area([{ ...play }]), area([{ ...play, hidden: false }]))).toBe(true);
    expect(sameAreas(area([{ ...play }]), area([{ ...play, hidden: true }]))).toBe(false);
  });

  it("표시 속성이 바뀌면 다르다 — 배율·글자 크기·색도 저장 대상이다", () => {
    expect(sameAreas(area([{ ...play }]), area([{ ...play, scale: 1.75 }]))).toBe(false);
    expect(sameAreas(area([{ ...play }]), area([{ ...play, fontSize: 15 }]))).toBe(false);
    expect(sameAreas(area([{ ...play }]), area([{ ...play, color: "#fff3dc" }]))).toBe(false);
  });

  it("슬롯이 늘거나 줄면 다르다", () => {
    expect(sameAreas(area([{ ...play }]), area([{ ...play }, { ...play, id: "play2" }]))).toBe(false);
    expect(sameAreas(area([{ ...play }]), area([]))).toBe(false);
  });

  it("영역 이름이 바뀌면 다르다 — 라벨도 저장 대상이라 빠뜨리면 덮어쓰기가 열린다", () => {
    const renamed: UiArea[] = [{ id: "lobby", label: "로비(목장)", slots: [{ ...play }] }];
    expect(sameAreas(area([{ ...play }]), renamed)).toBe(false);
  });

  it("영역이 늘면 다르다", () => {
    const two = [...area([{ ...play }]), { id: "world", label: "월드", slots: [] }];
    expect(sameAreas(area([{ ...play }]), two)).toBe(false);
  });
});
