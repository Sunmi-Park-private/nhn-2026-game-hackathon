// data/animals.ts — 도감 목록. 스테이지의 animalId가 여기 id와 맞아야 도감에 채워진다.
export interface AnimalDef {
  id: string;
  name: string;
  /** 아트가 없을 때 쓰는 글리프 */
  glyph: string;
}

/** 시안의 도감 순서 그대로다 — 격자 기본 배치가 아트와 맞아야 한다. */
export const ANIMALS: readonly AnimalDef[] = [
  { id: "rabbit", name: "토끼", glyph: "🐰" },
  { id: "monkey", name: "원숭이", glyph: "🐵" },
  { id: "deer", name: "사슴", glyph: "🦌" },
  { id: "sheep", name: "양", glyph: "🐑" },
  { id: "zebra", name: "얼룩말", glyph: "🦓" },
  { id: "elephant", name: "코끼리", glyph: "🐘" },
];
