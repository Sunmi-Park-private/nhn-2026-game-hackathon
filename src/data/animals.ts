// data/animals.ts — 도감 목록. 스테이지의 animalId가 여기 id와 맞아야 도감에 채워진다.
export interface AnimalDef {
  id: string;
  name: string;
  /** 아트가 없을 때 쓰는 글리프 */
  glyph: string;
}

export const ANIMALS: readonly AnimalDef[] = [
  { id: "sheep", name: "양", glyph: "🐑" },
  { id: "zebra", name: "얼룩말", glyph: "🦓" },
  { id: "deer", name: "사슴", glyph: "🦌" },
  { id: "elephant", name: "코끼리", glyph: "🐘" },
  { id: "penguin", name: "펭귄", glyph: "🐧" },
  { id: "rabbit", name: "토끼", glyph: "🐰" },
  { id: "monkey", name: "원숭이", glyph: "🐵" },
];
