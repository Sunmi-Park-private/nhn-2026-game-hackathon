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
  /** assets.json 안의 위치(점 경로). 아트가 없는 슬롯은 비어 있다. */
  asset?: string;
  /** 꺼짐 상태의 아트. 토글처럼 두 장을 오가는 슬롯만 갖는다 —
   *  asset이 켜짐, assetOff가 꺼짐이다. */
  assetOff?: string;

  // ── 표시 속성 — 레이아웃 에디터에서 지정했을 때만 존재한다 ──
  /** 이미지·컨테이너 배율 (1 = 원본) */
  scale?: number;
  /** 안에 든 텍스트의 크기(px) */
  fontSize?: number;
  /** 안에 든 텍스트의 색 "#rrggbb" */
  color?: string;
  /** 화면에서 끄기 — 배경 아트가 이미 그린 폴백을 지울 때 */
  hidden?: boolean;
}

/** 위치 개념이 없는 업로드 전용 항목 — 타일·동물·배경처럼 자리가 코드에 고정된 것들. */
export interface UiUpload {
  label: string;
  asset: string;
  /** 이미지 시퀀스 슬롯 — 에디터가 여러 장을 한 번에 받는다 */
  seq?: boolean;
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
          asset: typeof t.asset === "string" ? t.asset : undefined,
          assetOff: typeof t.assetOff === "string" ? t.assetOff : undefined,
          scale: typeof t.scale === "number" ? t.scale : undefined,
          fontSize: typeof t.fontSize === "number" ? t.fontSize : undefined,
          color: typeof t.color === "string" ? t.color : undefined,
          hidden: t.hidden === true ? true : undefined,
        };
      }),
    };
  });
}

export const uiAreas: UiArea[] = parseAreas(layoutJson);

function parseUploads(raw: unknown): UiUpload[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => u as Record<string, unknown>)
    .filter((u) => typeof u.asset === "string")
    .map((u) => ({ label: String(u.label ?? u.asset), asset: String(u.asset), seq: u.seq === true }));
}

export const uiUploads: UiUpload[] = parseUploads((layoutJson as { uploads?: unknown }).uploads);

/** 영상 슬롯 — 인트로·엔딩. 세로 화면 전체를 덮는다. */
export const uiVideos: UiUpload[] = parseUploads((layoutJson as { videos?: unknown }).videos);

/** 오디오 슬롯 — BGM·효과음. 위치 개념이 없어 업로드 목록으로만 산다. */
export const uiAudios: UiUpload[] = parseUploads((layoutJson as { audios?: unknown }).audios);

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
