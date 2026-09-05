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
  /** 두 상태를 뭐라 부를지 — 에디터의 카드 이름에 붙는다. 기본은 ["켜짐","꺼짐"].
   *  도감처럼 켜짐/꺼짐이 어색한 곳에서 ["해제","잠김"]처럼 바꿔 준다. */
  states?: [string, string];

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
  /** 묶음 이름 — 에디터가 같은 값끼리 모아 구분선과 머리글을 그린다.
   *  목록 순서가 곧 표시 순서다. 없으면 앞 항목의 묶음에 이어 붙는다. */
  group?: string;
  /** 시퀀스 안의 한 프레임을 가리키는 숫자를 저장할 매니페스트 점 경로.
   *  이 값이 있는 슬롯에만 에디터가 프레임 스크러버를 붙인다. */
  hold?: string;
}

export interface UiArea {
  id: string;
  label: string;
  slots: UiSlot[];
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** 배치 JSON을 타입으로 받는다. 디스크에서 막 읽은 값도 반드시 여기를 지난다 —
 *  디자이너가 손으로 고친 파일이 슬롯 하나를 빠뜨려도 화면이 아니라 여기서 흡수한다. */
export function parseAreas(raw: unknown): UiArea[] {
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
          states: Array.isArray(t.states) && t.states.length === 2
            && typeof t.states[0] === "string" && typeof t.states[1] === "string"
            ? [t.states[0], t.states[1]]
            : undefined,
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
    .map((u) => ({
      label: String(u.label ?? u.asset),
      asset: String(u.asset),
      seq: u.seq === true,
      group: typeof u.group === "string" ? u.group : undefined,
      hold: typeof u.hold === "string" ? u.hold : undefined,
    }));
}

export const uiUploads: UiUpload[] = parseUploads((layoutJson as { uploads?: unknown }).uploads);

/** 영상 슬롯 — 인트로·엔딩. 세로 화면 전체를 덮는다. */
export const uiVideos: UiUpload[] = parseUploads((layoutJson as { videos?: unknown }).videos);

/** 오디오 슬롯 — BGM·효과음. 위치 개념이 없어 업로드 목록으로만 산다. */
export const uiAudios: UiUpload[] = parseUploads((layoutJson as { audios?: unknown }).audios);

/** 배치 비교용 정규화 — 슬롯의 뜻 있는 값만 정해진 순서로 뽑는다.
 *  디스크에서 막 읽은 JSON과 파서를 거친 값은 키 순서도 잉여 필드도 다를 수 있어
 *  그대로 문자열로 견주면 안 바뀐 것도 바뀐 것으로 나온다. */
function normalizeAreas(areas: readonly UiArea[]): string {
  return JSON.stringify(areas.map((a) => [
    a.id,
    a.label,
    (a.slots ?? []).map((s) => [
      s.id, s.label, s.x, s.y, s.w, s.h,
      s.asset ?? null, s.assetOff ?? null, s.states ?? null,
      s.scale ?? null, s.fontSize ?? null, s.color ?? null, s.hidden === true,
    ]),
  ]));
}

/** 두 배치가 같은가. 에디터 둘이 같은 파일을 보고 있어 「내가 읽어 온 뒤로
 *  디스크가 바뀌었나」를 물어야 한다 — 안 물으면 저장이 남의 편집을 덮어쓴다. */
export function sameAreas(a: readonly UiArea[], b: readonly UiArea[]): boolean {
  return normalizeAreas(a) === normalizeAreas(b);
}

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
