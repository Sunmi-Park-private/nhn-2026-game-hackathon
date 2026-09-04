// data/uiLayout.ts — UI 슬롯 배치. 좌표계는 중앙 콘텐츠 컬럼 450×800이다.
//
// 화면 코드가 좌표를 들고 있지 않게 한다 — 에디터(/ui.html)가 이 파일을 고치고,
// 화면은 id로 슬롯을 찾아 쓴다. 슬롯이 없으면 화면이 스스로 기본값을 쓴다(깨지지 않는다).
import layoutJson from "./uiLayout.json";

export interface UiSlot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiArea {
  id: string;
  label: string;
  slots: UiSlot[];
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function parseAreas(raw: unknown): UiArea[] {
  const areas = (raw as { areas?: unknown }).areas;
  if (!Array.isArray(areas)) return [];
  return areas.map((a) => {
    const o = a as Record<string, unknown>;
    const slots = Array.isArray(o.slots) ? o.slots : [];
    return {
      id: String(o.id ?? ""),
      label: String(o.label ?? o.id ?? ""),
      slots: slots.map((s) => {
        const t = s as Record<string, unknown>;
        return {
          id: String(t.id ?? ""),
          label: String(t.label ?? t.id ?? ""),
          x: num(t.x, 0), y: num(t.y, 0), w: num(t.w, 40), h: num(t.h, 40),
        };
      }),
    };
  });
}

export const uiAreas: UiArea[] = parseAreas(layoutJson);

/** 영역 안의 슬롯. 없으면 null — 호출부가 기본값으로 간다. */
export function slot(areaId: string, slotId: string): UiSlot | null {
  const area = uiAreas.find((a) => a.id === areaId);
  return area?.slots.find((s) => s.id === slotId) ?? null;
}

/** 슬롯의 중심점. 배치를 좌상단으로 저장하고 쓰는 쪽은 중심을 원하는 경우가 많다. */
export function slotCenter(areaId: string, slotId: string, fallback: { x: number; y: number }): { x: number; y: number } {
  const s = slot(areaId, slotId);
  return s ? { x: s.x + s.w / 2, y: s.y + s.h / 2 } : fallback;
}
