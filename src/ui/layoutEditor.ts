// ui/layoutEditor.ts — 인게임 레이아웃 에디터. `?editor=1`로 켠다.
//
// 이전 프로젝트 에디터의 구조를 그대로 옮겼다:
//   · 투명 실드가 게임 입력을 가로챈다. **조작 모드**로 걷으면 게임이 정상 동작한다
//     (실드가 입력을 다 삼키면 PLAY도 못 눌러 다른 화면으로 갈 수가 없다)
//   · 등록(editable)은 에디터가 꺼져 있어도 항상 기록한다 — 켜는 순간 전 항목 편집 가능
//   · 초록 정렬 격자 = 편집 모드 표시이자 드래그 기준선. 흰 베일 대신 선을 쓴다 —
//     색을 조정하는 중에 화면을 덮으면 색 판단이 흐려진다
//   · 드래그는 10px에 붙는다(Alt = 1px)
//   · 텍스트 항목 → 크기·색 팔레트 / 그림 항목 → 배율 / 공통 → 숨김
//   · 이름을 누르면 화면에 빨간 테두리로 어디인지 보여 준다
//   · 값이 바뀌면 자동 저장, 「지금 저장」으로 즉시 반영
//
// 저장은 /ui.html과 같은 파일(src/data/uiLayout.json)로 간다 — 두 에디터가 같은 값을 만진다.
import { Container, Graphics, Text, type FederatedPointerEvent } from "pixi.js";
import { uiAreas, parseAreas, type UiArea, type UiSlot } from "../data/uiLayout";
import { BASE_W, stageTop, stageHeight } from "./stage";
import { createHistory, restoreInto, type History } from "./layoutHistory";
import { hasEditorServer, NO_EDITOR_SERVER, readJson } from "./editorServer";

const on = typeof location !== "undefined" && new URLSearchParams(location.search).has("editor");
export const layoutEditorEnabled = (): boolean => on;

interface Entry {
  area: string;
  slot: UiSlot;
  node: Container;
  baseW: number;
  baseH: number;
  baseX: number;
  baseY: number;
  slotX: number;
  slotY: number;
}

const entries = new Map<string, Entry>();
const key = (area: string, id: string): string => `${area}/${id}`;

/** 컨테이너 안의 텍스트 노드를 모은다 — 크기·색을 한 번에 바꾸기 위해서. */
function textsIn(node: Container): Text[] {
  const out: Text[] = [];
  const walk = (n: Container): void => {
    if (n instanceof Text) out.push(n);
    for (const c of n.children) walk(c as Container);
  };
  walk(node);
  return out;
}

/** 그림(스프라이트·그래픽)이 들어 있는가 — 배율 컨트롤을 보일지 정한다. */
function hasVisual(node: Container): boolean {
  let found = false;
  const walk = (n: Container): void => {
    if (found) return;
    if (!(n instanceof Text) && n.children.length === 0 && n !== node) found = true;
    for (const c of n.children) walk(c as Container);
  };
  walk(node);
  return found;
}

/**
 * 노드의 기준점을 **자기 그림의 정가운데**로 옮긴다.
 *
 * Pixi의 scale은 노드 원점을 기준으로 커진다. 원점이 좌상단인 컨테이너(로비 버튼,
 * HUD 묶음 등)를 그대로 확대하면 오른쪽 아래로만 자라 자리가 밀린다.
 * pivot을 그림 중심으로 옮기고 위치를 같은 만큼 보정하면, 배율이 1일 때는 아무것도
 * 달라지지 않으면서 확대·축소만 **가운데 정렬**로 일어난다.
 *
 * 이미 중심 정렬된 스프라이트(anchor 0.5)는 중심이 원점이라 보정값이 0이다 — 안전하다.
 */
function centerPivot(node: Container): void {
  const b = node.getLocalBounds();
  if (!(b.width > 0) || !(b.height > 0)) return; // 아직 그릴 것이 없는 노드
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  if (cx === 0 && cy === 0) return;
  node.pivot.set(cx, cy);
  // pivot을 옮기면 그만큼 그림이 왼쪽 위로 밀린다 — 현재 배율을 곱해 되돌린다
  node.x += cx * node.scale.x;
  node.y += cy * node.scale.y;
}

/** 저장된 표시 속성을 노드에 입힌다. 등록 때 한 번 부르면 새로고침 후에도 유지된다. */
function applyStyle(e: Entry): void {
  const s = e.slot;
  e.node.visible = s.hidden !== true;
  if (s.scale !== undefined && s.scale > 0) e.node.scale.set(s.scale);
  if (s.fontSize === undefined && s.color === undefined) return;
  for (const t of textsIn(e.node)) {
    if (s.fontSize !== undefined && s.fontSize > 0) t.style.fontSize = s.fontSize;
    if (s.color !== undefined) t.style.fill = s.color;
  }
}

/**
 * 화면이 만든 노드를 슬롯에 묶는다. 에디터가 꺼져 있어도 부담이 없다.
 * 저장된 표시 속성(숨김·배율·글자 크기·색)은 여기서 입힌다 — 화면 코드가 몰라도 된다.
 */
export function editable(area: string, slot: UiSlot, node: Container): void {
  // 기준점을 먼저 옮긴다 — baseX/baseY가 보정된 좌표를 기준으로 기록돼야 한다
  centerPivot(node);
  const e: Entry = {
    area, slot, node,
    baseW: slot.w, baseH: slot.h,
    baseX: node.x, baseY: node.y,
    slotX: slot.x, slotY: slot.y,
  };
  entries.set(key(area, slot.id), e);
  applyStyle(e);
}

/** 화면이 내려갈 때 등록을 지운다 — 파괴된 노드를 잡고 있으면 에디터가 죽는다. */
export function clearEditable(area: string): void {
  for (const [k, e] of entries) if (e.area === area) entries.delete(k);
}

// ── 여기부터는 에디터가 켜졌을 때만 산다 ──────────────────────
let shield: Graphics | null = null;
let outline: Graphics | null = null;
let selected: string | null = null;
// 조작 모드로 시작한다. 게임 화면을 여는 사람은 대개 **먼저 눌러 보고** 나서
// 자리를 고친다 — 격자가 깔린 채로 뜨면 그때마다 ` 를 눌러 꺼야 했다.
let interact = true;
let panel: HTMLDivElement | null = null;
let statusEl: HTMLElement | null = null;
let saveStatus = "";
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let altHeld = false;
let history: History<UiArea[]> | null = null;
/** 지금 들고 있는 배치를 읽어 온 시점의 서버 리비전.
 *  저장할 때 함께 보내면 서버가 「그 뒤로 누가 썼나」를 쓰기 직전에 판정한다.
 *  이것이 없던 동안 이 창의 자동 저장이 /ui.html의 편집을 통째로 덮었다. */
let layoutRev = "";
/** 저장되지 않은 편집이 있나. 이게 서 있으면 다른 창의 배치를 **받아들이지 않는다** —
 *  받아들이면 방금 끈 값이 디스크 값으로 되돌아가고, 뒤이어 뜨는 자동 저장이
 *  그 되돌려진 값을 새 리비전으로 써서 「저장됨」이라고 말한다. */
let unsaved = false;
/** 마지막 저장이 409로 막혔나. 「지금 저장」이 덮어쓰기로 바뀐다. */
let conflicted = false;
/** 지금 끌고 있는 항목. mountLayoutEditor 안에서 쓰지만 따라잡기 판단에도 쓰여
 *  모듈 자리에 둔다 — 끄는 도중에 슬롯을 갈아끼우면 손 밑에서 값이 바뀐다. */
let dragging: Entry | null = null;
/** 이 창의 표식 — 서버가 저장 알림에 실어 돌려주므로 자기 메아리를 거른다. */
const CLIENT_ID = `game-${Math.random().toString(36).slice(2)}`;

export const inputBlocked = (): boolean => on && !interact;

const live = (): Entry[] =>
  [...entries.values()].filter((e) => !e.node.destroyed && e.node.parent);

// ── 정렬 격자 ───────────────────────────────
// DOM 캔버스 오버레이다. Pixi 안에 그리면 화면이 새 레이어를 얹을 때마다 아래로 묻힌다.
// pointer-events:none 이라 입력은 그대로 실드가 받는다.
const GRID_MINOR = 10;
const GRID_MAJOR = 50;
const GRID_COLOR = 0x00c853; // 진한 초록 — 밝은 배경 아트에 묻히지 않는다
const A_MINOR = 0.28, A_MAJOR = 0.55, A_CENTER = 0.95, A_EDGE = 0.85;
let gridEl: HTMLCanvasElement | null = null;
let gridResize: (() => void) | null = null;

const rgba = (n: number, a: number): string => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

function paintGrid(): void {
  const el = gridEl;
  const cv = document.querySelector("canvas");
  if (!el || !cv) return;
  const r = cv.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  // 게임 콘텐츠는 캔버스 가운데 450 폭 컬럼이다 — 격자도 거기에만 맞춘다
  const logicalW = cv.width / (window.devicePixelRatio > 1 ? Math.min(2, window.devicePixelRatio) : 1);
  const colScale = r.width / logicalW;
  const colLeft = r.left + (r.width - BASE_W * colScale) / 2;

  el.style.left = `${colLeft}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${BASE_W * colScale}px`;
  el.style.height = `${r.height}px`;
  el.width = Math.max(1, Math.round(BASE_W * colScale * dpr));
  el.height = Math.max(1, Math.round(r.height * dpr));

  const ctx = el.getContext("2d");
  if (!ctx) return;
  const top = stageTop();
  const H = stageHeight();
  const sx = (el.width / BASE_W);
  const sy = (el.height / H);
  ctx.clearRect(0, 0, el.width, el.height);
  const line = (x1: number, y1: number, x2: number, y2: number): void => {
    ctx.moveTo(x1 * sx, (y1 - top) * sy);
    ctx.lineTo(x2 * sx, (y2 - top) * sy);
  };
  // 세로선은 중앙에서 좌우로 뻗는다 — 0에서 시작하면 중앙선만 홀로 서서 격자가 안 맞아 보인다
  const cx = BASE_W / 2;
  const colsAt = (step: number): number[] => {
    const out: number[] = [];
    for (let x = cx; x <= BASE_W; x += step) out.push(x);
    for (let x = cx - step; x >= 0; x -= step) out.push(x);
    return out;
  };
  const majorX = new Set(colsAt(GRID_MAJOR));

  ctx.beginPath();
  for (const x of colsAt(GRID_MINOR)) if (!majorX.has(x)) line(x, top, x, top + H);
  for (let y = Math.ceil(top / GRID_MINOR) * GRID_MINOR; y <= top + H; y += GRID_MINOR) {
    if (y % GRID_MAJOR !== 0) line(0, y, BASE_W, y);
  }
  ctx.strokeStyle = rgba(GRID_COLOR, A_MINOR);
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();

  ctx.beginPath();
  for (const x of majorX) if (x !== cx) line(x, top, x, top + H);
  for (let y = Math.ceil(top / GRID_MAJOR) * GRID_MAJOR; y <= top + H; y += GRID_MAJOR) line(0, y, BASE_W, y);
  ctx.strokeStyle = rgba(GRID_COLOR, A_MAJOR);
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();

  // 중앙선 — 가운데 정렬 확인용. 가장 밝게
  ctx.beginPath();
  line(cx, top, cx, top + H);
  ctx.strokeStyle = rgba(GRID_COLOR, A_CENTER);
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(0, 0, el.width, el.height);
  ctx.strokeStyle = rgba(GRID_COLOR, A_EDGE);
  ctx.lineWidth = 3 * dpr;
  ctx.stroke();
}

function mountGrid(): void {
  if (!gridEl) {
    const el = document.createElement("canvas");
    el.style.cssText = "position:fixed;z-index:1250;pointer-events:none";
    document.body.appendChild(el);
    gridEl = el;
    gridResize = (): void => paintGrid();
    window.addEventListener("resize", gridResize);
  }
  paintGrid();
}

function unmountGrid(): void {
  if (gridResize) window.removeEventListener("resize", gridResize);
  gridResize = null;
  gridEl?.remove();
  gridEl = null;
}

// ── 선택 표시 ───────────────────────────────
function drawOutline(): void {
  if (!outline) return;
  outline.clear();
  const e = selected ? entries.get(selected) : null;
  if (!e || e.node.destroyed) return;
  const s = e.slot;
  // 배율이 걸려 있으면 실제로 보이는 크기를 그린다 — 상자만 그리면 어디가 잡혔는지 어긋난다
  const k = s.scale ?? 1;
  const w = s.w * k;
  const h = s.h * k;
  outline.rect(s.x + (s.w - w) / 2, stageTop() + s.y + (s.h - h) / 2, w, h)
    .fill({ color: 0xff2d2d, alpha: 0.06 })
    .stroke({ width: 2, color: 0xff2d2d, alpha: 0.95, alignment: 0 });
}

function apply(e: Entry): void {
  if (e.node.destroyed) return;
  // 앵커가 제각각이라 절대 좌표가 아니라 **등록 시점 대비 변위**로 옮긴다
  e.node.x = e.baseX + (e.slot.x - e.slotX);
  e.node.y = e.baseY + (e.slot.y - e.slotY);
  const sc = e.slot.scale ?? 1;
  e.node.scale.set((e.slot.w / e.baseW) * sc, (e.slot.h / e.baseH) * sc);
  e.node.visible = e.slot.hidden !== true;
  drawOutline();
}

// ── 저장 ────────────────────────────────────
function setStatus(text: string, color: string): void {
  saveStatus = text;
  if (statusEl) { statusEl.textContent = text; statusEl.style.color = color; }
}

/** 지금 배치를 히스토리에 남긴다. 편집이 끝난 지점마다 부른다. */
function commit(): void {
  history?.record(uiAreas);
  renderPanel(); // 되돌리기 버튼의 활성 상태를 바로 반영한다
}

/** 되돌린 값을 화면에 다시 입힌다 — 등록된 노드 전부에 적용하고 저장까지 예약한다. */
function applyAll(): void {
  for (const e of live()) apply(e);
  drawOutline();
  renderPanel();
  scheduleSave();
}

function doUndo(): void {
  const snap = history?.undo();
  if (!snap) return;
  restoreInto(uiAreas as never, snap as never);
  applyAll();
}

function doRedo(): void {
  const snap = history?.redo();
  if (!snap) return;
  restoreInto(uiAreas as never, snap as never);
  applyAll();
}

function scheduleSave(): void {
  unsaved = true;
  setStatus("변경됨 — 곧 저장", "#f0c96a");
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void flushSave(); }, 600);
}

async function flushSave(force = false): Promise<void> {
  if (saveTimer !== undefined) { clearTimeout(saveTimer); saveTimer = undefined; }
  // 빌드본에는 저장 서버가 없다 — 요청을 보내면 SPA 폴백 HTML이 200으로 와서
  // JSON 오류로 터진다. 보내기 전에 말한다.
  if (!hasEditorServer()) { setStatus(NO_EDITOR_SERVER, "#ff8f7a"); return; }
  setStatus("저장 중…", "#a8987c");
  try {
    const cur = await fetch("/__uilayout").then((r) => (r.ok ? readJson(r) : {})) as Record<string, unknown>;
    const res = await fetch(
      `/__uilayout?by=${encodeURIComponent(CLIENT_ID)}&rev=${encodeURIComponent(force ? "force" : layoutRev)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...cur, areas: uiAreas }),
      },
    );
    // 읽어 온 뒤로 파일이 바뀌었다. **여기 값을 밀어 넣지 않는다** — uiAreas는
    // 이 페이지를 열 때의 전체 배치라, 그냥 쓰면 저쪽 편집이 통째로 사라진다.
    // 리비전도 따라가지 않는다: 따라가면 다음 저장이 검사를 통과해 같은 일이 난다.
    if (res.status === 409) {
      conflicted = true;
      setStatus("저장 안 됨 — 파일이 더 새롭습니다. 「덮어써서 저장」이나 새로고침", "#f0c96a");
      renderPanel();
      return;
    }
    if (!res.ok) throw new Error(await res.text());
    layoutRev = res.headers.get("x-layout-rev") ?? layoutRev;
    unsaved = false;
    conflicted = false;
    setStatus("저장됨", "#8fdc8f");
    renderPanel();
  } catch (err) {
    setStatus(`실패: ${String(err)}`, "#ff8f7a");
  }
}

/** 열 때 디스크의 리비전을 받아 둔다. 이 값이 있어야 저장이 판정을 받는다. */
async function readRev(): Promise<void> {
  try {
    const r = await fetch("/__uilayout");
    if (r.ok) layoutRev = r.headers.get("x-layout-rev") ?? "";
  } catch { /* dev 서버 밖 — 저장도 안 된다 */ }
}

/** 다른 창이 쓴 배치를 따라간다.
 *
 *  **받아들이지 않는 경우가 받아들이는 경우보다 중요하다.** 편집이 남아 있거나
 *  끄는 중이면 손대지 않고 리비전도 올리지 않는다 — 올리면 뒤이어 뜨는 저장이
 *  검사를 통과해 저쪽 편집을 지운다. 슬롯 구성이 다를 때도 마찬가지다:
 *  restoreInto는 양쪽에 다 있는 슬롯만 갱신하므로 디스크에 새로 생긴 슬롯을
 *  못 받는데, 리비전만 올리면 다음 저장이 그 슬롯을 파일에서 지운다. */
async function catchUpLayout(): Promise<void> {
  if (!on) return;
  try {
    const r = await fetch("/__uilayout");
    if (!r.ok) return;
    const fresh = parseAreas(await r.json());
    if (fresh.length === 0) return;
    const rev = r.headers.get("x-layout-rev") ?? "";
    if (rev === layoutRev) return;

    if (unsaved || dragging) {
      setStatus("다른 창에서 배치가 바뀌었습니다 — 저장하거나 새로고침해 맞추세요", "#f0c96a");
      return;
    }
    if (!sameShape(uiAreas, fresh)) {
      setStatus("파일의 슬롯 구성이 달라졌습니다 — 새로고침해야 합니다", "#f0c96a");
      return;
    }
    // 배열을 갈아끼우지 않는다 — 화면이 들고 있는 슬롯 참조가 끊긴다
    restoreInto(uiAreas as never, fresh as never);
    layoutRev = rev;
    conflicted = false;
    for (const e of live()) apply(e);
    drawOutline();
    history?.reset(uiAreas);
    renderPanel();
    setStatus("다른 창의 배치를 읽었습니다", "#8fdc8f");
  } catch { /* dev 서버 밖 */ }
}

/** 영역·슬롯 구성이 같은가. restoreInto가 값만 옮길 수 있는 조건이다. */
function sameShape(a: readonly UiArea[], b: readonly UiArea[]): boolean {
  const shape = (areas: readonly UiArea[]): string =>
    areas.map((ar) => `${ar.id}:${ar.slots.map((sl) => sl.id).join(",")}`).join("|");
  return shape(a) === shape(b);
}

/** 다른 창의 저장을 듣는다. 알림이 안 오는 변경(손편집·git checkout)도 있어
 *  창을 다시 볼 때마다 한 번 더 확인한다 — 안 그러면 리비전이 어긋난 채로
 *  이후 모든 자동 저장이 409에 막히고 사람은 이유를 모른다. */
function watchLayout(): void {
  import.meta.hot?.on("layout-updated", (d: { by?: string }) => {
    if (d?.by === CLIENT_ID) return;
    void catchUpLayout();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void catchUpLayout();
  });
  window.addEventListener("focus", () => { void catchUpLayout(); });
}

// ── 모드 ────────────────────────────────────
function setInteract(next: boolean): void {
  interact = next;
  if (shield) shield.eventMode = interact ? "none" : "static";
  if (interact) unmountGrid(); else mountGrid();
  renderPanel();
}

export function setEditorPanelVisible(v: boolean): void {
  if (panel) panel.style.display = v ? "block" : "none";
}

// ── 패널 ────────────────────────────────────
const PALETTE: Array<[string, string]> = [
  ["#fff3dc", "크림"], ["#f0c96a", "골드"], ["#ffffff", "흰색"], ["#241a10", "먹"],
  ["#c98a3c", "나무"], ["#3faa48", "초록"], ["#d23b30", "빨강"], ["#8a7a63", "회갈색"],
  ["#a8987c", "서브"], ["#ffd76a", "노랑"], ["#66c2ff", "하늘"], ["#ff9db8", "핑크"],
];

const CSS = {
  num: "width:48px;padding:2px 4px;border:1px solid #4a3320;border-radius:5px;background:#14100c;color:#e8dcc8;font:11px system-ui",
  tag: "font-size:9.5px;color:#a8987c;margin-right:2px",
  btn: "font-size:10px;padding:2px 6px;border:1px solid #4a3320;border-radius:6px;background:#2b1d10;color:#e8dcc8;cursor:pointer",
};

function mkNum(v: number, tag: string, applyFn: (n: number) => void, step = 1): HTMLElement {
  const s = document.createElement("span");
  s.style.cssText = "display:inline-flex;align-items:center";
  const t = document.createElement("span");
  t.textContent = tag;
  t.style.cssText = CSS.tag;
  const i = document.createElement("input");
  i.type = "number";
  i.step = String(step);
  i.value = String(step < 1 ? Math.round(v * 100) / 100 : Math.round(v));
  i.style.cssText = CSS.num;
  i.onchange = (): void => applyFn(Number(i.value));
  s.append(t, i);
  return s;
}

/** 이름 복사 — clipboard API는 보안 컨텍스트에서만 된다. 터널 http 접속용 폴백을 둔다. */
function copyFallback(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}

function buildRow(e: Entry): HTMLElement {
  const k = key(e.area, e.slot.id);
  const isSel = k === selected;
  const texts = textsIn(e.node);
  const visual = hasVisual(e.node);

  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:3px 0;padding:4px 6px;border-radius:7px;border:1px solid "
    + (isSel ? "#ff2d2d" : "transparent") + ";background:" + (isSel ? "#33150f" : "transparent");

  const head = document.createElement("div");
  head.style.cssText = "display:flex;gap:5px;align-items:center";

  const icon = texts.length > 0 && visual ? "🖼🅣 " : texts.length > 0 ? "🅣 " : visual ? "🖼 " : "◻︎ ";
  const label = document.createElement("button");
  label.textContent = icon + e.slot.label;
  label.title = "클릭하면 화면에서 빨간 테두리로 표시";
  label.style.cssText = "min-width:0;text-align:left;border:0;background:none;padding:2px 0;cursor:pointer;"
    + `font:700 11.5px system-ui;color:${isSel ? "#ff8f7a" : "#e8dcc8"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
  label.onclick = (): void => { selected = isSel ? null : k; drawOutline(); renderPanel(); };

  const copy = document.createElement("button");
  copy.textContent = "⧉";
  copy.title = "슬롯 이름 복사";
  copy.style.cssText = "flex-shrink:0;border:0;background:none;padding:2px 3px;cursor:pointer;font-size:11px;color:#a8987c";
  copy.onclick = (ev): void => {
    ev.stopPropagation();
    const done = (ok: boolean): void => {
      copy.textContent = ok ? "✓" : "✕";
      setTimeout(() => { copy.textContent = "⧉"; }, 900);
    };
    navigator.clipboard?.writeText(e.slot.id).then(() => done(true)).catch(() => done(copyFallback(e.slot.id)))
      ?? done(copyFallback(e.slot.id));
  };

  const spacer = document.createElement("span");
  spacer.style.cssText = "flex:1";

  head.append(label, copy, spacer,
    mkNum(e.slot.x, "x", (n) => { e.slot.x = n; apply(e); commit(); scheduleSave(); }),
    mkNum(e.slot.y, "y", (n) => { e.slot.y = n; apply(e); commit(); scheduleSave(); }),
  );
  wrap.appendChild(head);

  const line2 = document.createElement("div");
  line2.style.cssText = "display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap";
  line2.append(
    mkNum(e.slot.w, "w", (n) => { e.slot.w = Math.max(1, n); apply(e); commit(); scheduleSave(); }),
    mkNum(e.slot.h, "h", (n) => { e.slot.h = Math.max(1, n); apply(e); commit(); scheduleSave(); }),
  );
  // 배율은 **모든 슬롯**에 준다. 예전에는 hasVisual()이 true인 것만 줬는데,
  // 그러면 글자만 그리는 슬롯(코인·젬·말굽 숫자)에 배율 칸이 없었다 — 글자 크기와
  // 별개로 묶음째 키우고 싶을 때 손댈 방법이 없다(QA: 「배율 파라미터가 누락됐다」).
  // 배율은 노드 전체에 걸리는 값이라 그림이 없어도 뜻이 있다.
  {
    line2.appendChild(mkNum(e.slot.scale ?? 1, "배율", (n) => {
      if (!(n > 0)) return;
      e.slot.scale = n === 1 ? undefined : n;
      apply(e);
      commit();
      scheduleSave();
    }, 0.05));
  }
  const hide = document.createElement("button");
  hide.textContent = e.slot.hidden ? "숨김 해제" : "숨기기";
  hide.title = "배경 아트가 이미 그린 폴백을 화면에서 끈다";
  hide.style.cssText = CSS.btn;
  hide.onclick = (): void => {
    e.slot.hidden = e.slot.hidden ? undefined : true;
    apply(e);
    commit();
    scheduleSave();
    renderPanel();
  };
  line2.appendChild(hide);
  wrap.appendChild(line2);

  // 텍스트 항목 → 크기 + 색 팔레트
  if (texts.length > 0) {
    const line3 = document.createElement("div");
    line3.style.cssText = "display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap";
    const t0 = texts[0]!;
    line3.appendChild(mkNum(e.slot.fontSize ?? Number(t0.style.fontSize), "크기", (n) => {
      if (!(n > 0)) return;
      e.slot.fontSize = n;
      for (const t of texts) t.style.fontSize = n;
      commit();
      scheduleSave();
    }));
    const sw = document.createElement("span");
    sw.style.cssText = "display:inline-flex;gap:2px;flex-wrap:wrap";
    const cur = (e.slot.color ?? "").toLowerCase();
    for (const [hex, title] of PALETTE) {
      const b = document.createElement("button");
      b.title = title;
      b.style.cssText = `width:14px;height:14px;border-radius:4px;cursor:pointer;background:${hex};`
        + `border:${cur === hex ? "2px solid #ff2d2d" : "1px solid #4a3320"}`;
      b.onclick = (): void => {
        e.slot.color = hex;
        for (const t of texts) t.style.fill = hex;
        commit();
        scheduleSave();
        renderPanel();
      };
      sw.appendChild(b);
    }
    line3.appendChild(sw);
    if (e.slot.color !== undefined || e.slot.fontSize !== undefined) {
      const reset = document.createElement("button");
      reset.textContent = "초기화";
      reset.title = "코드 기본값으로 되돌림 (다시 그린 뒤 반영)";
      reset.style.cssText = CSS.btn;
      reset.onclick = (): void => {
        e.slot.color = undefined;
        e.slot.fontSize = undefined;
        commit();
        scheduleSave();
        renderPanel();
      };
      line3.appendChild(reset);
    }
    wrap.appendChild(line3);
  }

  return wrap;
}

function renderPanel(): void {
  if (!on || !panel) return;
  // 패널 안의 컨트롤을 조작하는 중이면 다시 그리지 않는다 — 주기적 rebuild가
  // 한 글자 칠 때마다 노드를 갈아치우면 포커스·커서가 날아간다
  const act = document.activeElement;
  if ((act instanceof HTMLInputElement || act instanceof HTMLSelectElement) && panel.contains(act)) return;

  panel.replaceChildren();

  const head = document.createElement("div");
  head.style.cssText = "position:sticky;top:-12px;z-index:2;background:#241a10;margin:-12px -12px 8px;padding:12px 12px 8px;border-bottom:1px solid #4a3320";
  const title = document.createElement("div");
  title.innerHTML = "<b>📐 레이아웃 에디터</b><br><small style='color:#a8987c'>드래그 · 좌표 입력 · 이름을 누르면 화면에서 "
    + "<span style='color:#ff8f7a;font-weight:700'>빨간 테두리</span>로 표시</small>";
  head.appendChild(title);

  const close = document.createElement("button");
  close.textContent = "✕";
  close.title = "에디터 닫기";
  close.style.cssText = "position:absolute;top:10px;right:12px;width:24px;height:24px;border:1px solid #4a3320;border-radius:50%;background:#2b1d10;color:#a8987c;font-weight:700;cursor:pointer;line-height:1";
  close.onclick = (): void => { setEditorPanelVisible(false); unmountGrid(); if (shield) shield.eventMode = "none"; };
  head.appendChild(close);

  const mode = document.createElement("button");
  mode.style.cssText = "width:100%;margin-top:8px;padding:8px 10px;border:0;border-radius:9px;cursor:pointer;text-align:left;"
    + `font:12px system-ui;line-height:1.5;color:#fff;background:${interact ? "#3faa48" : "#c98a3c"}`;
  mode.innerHTML = interact
    ? "<b>▶ 조작 중</b> — 격자가 꺼져 있습니다<br><span style='opacity:.85;font-size:11px'>게임이 정상 동작합니다 · 드래그로는 못 옮겨요<br><b>`</b> 또는 여기를 눌러 편집으로</span>"
    : "<b>✋ 편집 중</b> — 초록 격자가 보입니다<br><span style='opacity:.85;font-size:11px'>드래그로 옮기고 10px에 붙어요 (Alt = 1px)<br><b>`</b> 또는 여기를 눌러 조작으로 (화면 진행)</span>";
  mode.onclick = (): void => setInteract(!interact);
  head.appendChild(mode);

  const hist = document.createElement("div");
  hist.style.cssText = "display:flex;gap:6px;margin-top:8px";
  const mkHist = (text: string, title: string, enabled: boolean, fn: () => void): void => {
    const b = document.createElement("button");
    b.textContent = text;
    b.title = title;
    b.disabled = !enabled;
    b.style.cssText = "flex:1;padding:6px;border:1px solid #4a3320;border-radius:7px;font-weight:700;font-size:11px;"
      + `background:${enabled ? "#2b1d10" : "#1c150d"};color:${enabled ? "#e8dcc8" : "#6b5c46"};`
      + `cursor:${enabled ? "pointer" : "default"}`;
    b.onclick = fn;
    hist.appendChild(b);
  };
  mkHist("↩ 되돌리기", "⌘Z", history?.canUndo() === true, doUndo);
  mkHist("↪ 다시", "⇧⌘Z", history?.canRedo() === true, doRedo);
  head.appendChild(hist);

  panel.appendChild(head);

  const rows = live();
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "margin:8px 0;font-size:11.5px;color:#a8987c;line-height:1.6";
    empty.textContent = "이 화면엔 편집할 항목이 없습니다. 로비·스테이지·설정창에서 열면 목록이 나타납니다.";
    panel.appendChild(empty);
    return;
  }
  for (const e of rows) panel.appendChild(buildRow(e));

  const status = document.createElement("div");
  status.style.cssText = "margin-top:8px;font-size:10.5px;color:#a8987c;text-align:center";
  status.textContent = saveStatus;
  statusEl = status;
  panel.appendChild(status);

  const save = document.createElement("button");
  save.textContent = conflicted ? "💾 덮어써서 저장" : "💾 지금 저장";
  save.title = conflicted
    ? "파일이 더 새롭습니다 — 알고도 이 화면의 값으로 덮어씁니다"
    : "자동 저장을 기다리지 않고 바로 반영";
  save.style.cssText = "margin-top:4px;width:100%;padding:7px;border:0;border-radius:8px;background:#c98a3c;color:#241a10;font-weight:800;cursor:pointer";
  save.onclick = (): void => { void flushSave(conflicted); };
  panel.appendChild(save);
}

/** 게임 화면 위에 에디터를 얹는다. main이 부트 직후 한 번 부른다. */
export function mountLayoutEditor(stage: Container): void {
  if (!on) return;

  void readRev(); // 저장이 판정을 받으려면 지금 디스크의 리비전을 알아야 한다
  watchLayout();  // /ui.html이 쓰면 따라간다
  // 열자마자 말한다 — 편집을 다 하고 저장에서 알면 그 편집이 갈 곳이 없다
  if (!hasEditorServer()) setStatus(NO_EDITOR_SERVER, "#ff8f7a");

  const layer = new Container();
  layer.label = "layout-editor";
  stage.addChild(layer);

  shield = new Graphics().rect(-3000, -3000, 8000, 8000).fill({ color: 0x000000, alpha: 0 });
  // 조작 모드에서는 실드가 입력을 가로채지 않는다 — 게임이 정상 동작해야 한다
  shield.eventMode = interact ? "none" : "static";
  layer.addChild(shield);

  outline = new Graphics();
  layer.addChild(outline);

  // 화면이 새 레이어를 붙이면 그 아래로 묻힌다 — 주기적으로 맨 위로 되올린다
  setInterval(() => {
    if (stage.children.includes(layer)) stage.setChildIndex(layer, stage.children.length - 1);
  }, 400);

  panel = document.createElement("div");
  panel.style.cssText = "position:fixed;right:12px;top:12px;width:330px;max-height:86vh;overflow-y:auto;z-index:1300;"
    + "background:#241a10;border:1px solid #4a3320;border-radius:10px;padding:12px;"
    + "font:12px/1.5 system-ui,-apple-system,sans-serif;color:#e8dcc8;box-shadow:0 8px 24px #0008";
  document.body.appendChild(panel);

  if (!interact) mountGrid(); // 편집 모드일 때만 격자를 깐다

  history = createHistory<UiArea[]>(uiAreas);

  // ` 키로 편집 ⇄ 조작 — 손이 자주 오간다
  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Alt") altHeld = true;
    if (ev.key === "`") { ev.preventDefault(); setInteract(!interact); }
    // 입력칸 안에서는 브라우저의 글자 되돌리기를 그대로 둔다
    const act = document.activeElement;
    if (act instanceof HTMLInputElement || act instanceof HTMLTextAreaElement) return;
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      if (ev.shiftKey) doRedo(); else doUndo();
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "y") { ev.preventDefault(); doRedo(); }
  });
  window.addEventListener("keyup", (ev) => { if (ev.key === "Alt") altHeld = false; });

  // ── 드래그 ────────────────────────────────
  let startX = 0, startY = 0, ox = 0, oy = 0;
  const snap = (v: number): number => (altHeld ? Math.round(v) : Math.round(v / GRID_MINOR) * GRID_MINOR);

  shield.on("pointerdown", (ev) => {
    const p = ev.getLocalPosition(layer);
    // 겹치면 더 작은 항목을 고른다 — 큰 배경이 늘 가로채면 작은 버튼을 편집할 수 없다
    const hit = live()
      .filter((e) => e.slot.hidden !== true
        && p.x >= e.slot.x && p.x <= e.slot.x + e.slot.w
        && p.y >= stageTop() + e.slot.y && p.y <= stageTop() + e.slot.y + e.slot.h)
      .sort((a, b) => a.slot.w * a.slot.h - b.slot.w * b.slot.h)[0];
    if (!hit) { selected = null; drawOutline(); renderPanel(); return; }
    dragging = hit;
    selected = key(hit.area, hit.slot.id);
    startX = p.x; startY = p.y;
    ox = hit.slot.x; oy = hit.slot.y;
    drawOutline();
    renderPanel();
  });
  const onMove = (ev: FederatedPointerEvent): void => {
    if (!dragging) return;
    const p = ev.getLocalPosition(layer);
    dragging.slot.x = snap(ox + (p.x - startX));
    dragging.slot.y = snap(oy + (p.y - startY));
    apply(dragging);
  };
  // 실드 위에서 오는 이동과, 커서가 잠깐 벗어났을 때 오는 전역 이동을 둘 다 받는다.
  // 전역 것만 쓰면 브라우저·버전에 따라 안 오는 경우가 있어 드래그가 먹히지 않는다.
  shield.on("pointermove", onMove);
  shield.on("globalpointermove", onMove);
  const stop = (): void => {
    if (!dragging) return;
    dragging = null;
    commit(); // 드래그 한 번이 되돌리기 한 단계다
    scheduleSave();
    renderPanel();
    void catchUpLayout(); // 끄는 동안 미뤄 둔 따라잡기를 지금 한다
  };
  shield.on("pointerup", stop);
  shield.on("pointerupoutside", stop);
  // 창을 벗어난 채 손을 떼면 위 둘이 오지 않는다 — 걸린 채로 두면 따라잡기가 영영 멎는다
  window.addEventListener("blur", stop);

  // 화면이 바뀌면 목록도 바뀐다 — 등록은 화면이 하므로 주기적으로 다시 그린다
  setInterval(() => { renderPanel(); paintGrid(); }, 700);
  renderPanel();
}
