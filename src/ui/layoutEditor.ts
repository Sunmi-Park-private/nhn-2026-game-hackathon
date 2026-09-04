// ui/layoutEditor.ts — 인게임 레이아웃 에디터. `?editor=1`로 켠다.
//
// 이전 프로젝트의 에디터 구조를 그대로 가져왔다:
//   · 화면 최상단에 투명 실드를 깔아 게임 입력을 차단한다
//   · 등록(editable)은 에디터가 꺼져 있어도 항상 기록한다 — 켜는 순간 전 항목이 편집 가능
//   · 드래그로 이동, 패널에서 x/y/w/h 직접 입력
//   · **조작 모드** — 실드만 걷어 게임을 원래대로 진행시킨다. 선택·편집은 그대로 둔다
//     (실드가 입력을 다 삼키면 PLAY도 못 눌러 다른 화면으로 갈 수가 없다)
//   · 선택한 항목에 테두리를 그려 어떤 것이 잡혔는지 보여준다
//
// 저장은 /ui.html과 같은 파일(src/data/uiLayout.json)로 간다 — 두 에디터가 같은 값을 만진다.
import { Container, Graphics } from "pixi.js";
import { uiAreas, type UiSlot } from "../data/uiLayout";
import { BASE_W, BASE_H, stageTop } from "./stage";

const on = typeof location !== "undefined" && new URLSearchParams(location.search).has("editor");
export const layoutEditorEnabled = (): boolean => on;

/** 등록된 항목. 화면이 다시 그려지면 노드가 바뀌므로 매번 새로 등록된다. */
interface Entry {
  area: string;
  slot: UiSlot;
  node: Container;
  /** 등록 시점의 크기 — w/h를 바꿀 때 배율로 환산한다 */
  baseW: number;
  baseH: number;
  /** 등록 시점의 노드 좌표와 슬롯 좌표 — 둘의 차이를 유지한 채 옮긴다 */
  baseX: number;
  baseY: number;
  slotX: number;
  slotY: number;
}

const entries = new Map<string, Entry>();
const key = (area: string, id: string): string => `${area}/${id}`;

/**
 * 화면이 만든 노드를 슬롯에 묶는다. 에디터가 꺼져 있어도 부담이 없다(Map 한 줄).
 * 노드의 앵커가 무엇이든 상관없다 — 이동은 항상 **상대 변위**로 준다.
 */
export function editable(area: string, slot: UiSlot, node: Container): void {
  entries.set(key(area, slot.id), {
    area, slot, node,
    baseW: slot.w, baseH: slot.h,
    baseX: node.x, baseY: node.y,
    slotX: slot.x, slotY: slot.y,
  });
}

/** 화면이 내려갈 때 등록을 지운다 — 파괴된 노드를 잡고 있으면 에디터가 죽는다. */
export function clearEditable(area: string): void {
  for (const [k, e] of entries) if (e.area === area) entries.delete(k);
}

// ── 여기부터는 에디터가 켜졌을 때만 산다 ──────────────────────
let shield: Graphics | null = null;
let outline: Graphics | null = null;
let selected: string | null = null;
let interact = false;
let panel: HTMLElement | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** 게임 입력을 에디터가 가로채는 중인가 — 화면 쪽은 이 값을 본다. */
export const inputBlocked = (): boolean => on && !interact;

const live = (): Entry[] =>
  [...entries.values()].filter((e) => !e.node.destroyed && e.node.parent);

function drawOutline(): void {
  if (!outline) return;
  outline.clear();
  const e = selected ? entries.get(selected) : null;
  if (!e || e.node.destroyed) return;
  const s = e.slot;
  outline.rect(s.x, stageTop() + s.y, s.w, s.h).stroke({ width: 2, color: 0xff3b6b, alignment: 0 });
}

/** 슬롯 좌표를 바꾸고 화면의 노드에 즉시 반영한다. */
function apply(e: Entry): void {
  if (e.node.destroyed) return;
  // 앵커가 무엇이든 상관없게 **등록 시점 대비 변위**로 옮긴다
  e.node.x = e.baseX + (e.slot.x - e.slotX);
  e.node.y = e.baseY + (e.slot.y - e.slotY);
  // 크기는 배율로 흉내 낸다 — 정확한 모양은 다음 화면 진입에서 다시 그려진다
  e.node.scale.set(e.slot.w / e.baseW, e.slot.h / e.baseH);
  drawOutline();
}

function scheduleSave(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void save(); }, 600);
}

async function save(): Promise<void> {
  const note = panel?.querySelector("[data-status]") as HTMLElement | null;
  if (note) { note.textContent = "저장 중…"; note.style.color = "#a8987c"; }
  try {
    const cur = await fetch("/__uilayout").then((r) => (r.ok ? r.json() : {})) as Record<string, unknown>;
    const res = await fetch("/__uilayout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...cur, areas: uiAreas }),
    });
    if (!res.ok) throw new Error(await res.text());
    if (note) { note.textContent = "저장됨"; note.style.color = "#8fdc8f"; }
  } catch (err) {
    if (note) { note.textContent = `실패: ${String(err)}`; note.style.color = "#ff8f7a"; }
  }
}

function renderPanel(): void {
  if (!panel) return;
  panel.replaceChildren();

  const row = (style: string): HTMLElement => {
    const d = document.createElement("div");
    d.setAttribute("style", style);
    return d;
  };

  const head = row("display:flex;gap:8px;align-items:center;margin-bottom:8px");
  const title = row("font-weight:800;font-size:13px");
  title.textContent = "🎛 레이아웃 편집";
  const mode = document.createElement("button");
  mode.textContent = interact ? "편집 모드로" : "조작 모드로";
  mode.setAttribute("style", `background:${interact ? "#c98a3c" : "#3faa48"};color:#fff;border:0;border-radius:6px;padding:5px 10px;font-weight:700;cursor:pointer;font-size:11px`);
  mode.onclick = (): void => {
    interact = !interact;
    if (shield) shield.eventMode = interact ? "none" : "static";
    renderPanel();
  };
  const status = row("font-size:11px;color:#a8987c;margin-left:auto");
  status.dataset["status"] = "1";
  head.append(title, mode, status);
  panel.appendChild(head);

  const hint = row("font-size:11px;color:#a8987c;margin-bottom:8px");
  hint.textContent = interact
    ? "조작 모드 — 게임이 정상 동작합니다. 화면을 옮긴 뒤 편집 모드로 돌아오세요."
    : "화면의 항목을 끌어 옮기세요. 게임 입력은 잠겨 있습니다.";
  panel.appendChild(hint);

  const list = row("display:flex;flex-direction:column;gap:3px;max-height:180px;overflow:auto;margin-bottom:8px");
  for (const e of live()) {
    const k = key(e.area, e.slot.id);
    const b = document.createElement("button");
    b.textContent = `${e.slot.label}  ${Math.round(e.slot.x)},${Math.round(e.slot.y)}`;
    b.setAttribute("style", `text-align:left;background:${k === selected ? "#3a2a18" : "transparent"};color:#e8dcc8;border:1px solid #3a2a18;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px`);
    b.onclick = (): void => { selected = k; drawOutline(); renderPanel(); };
    list.appendChild(b);
  }
  panel.appendChild(list);

  const e = selected ? entries.get(selected) : null;
  if (e) {
    const grid = row("display:grid;grid-template-columns:repeat(4,1fr);gap:6px");
    (["x", "y", "w", "h"] as const).forEach((f) => {
      const lab = document.createElement("label");
      lab.setAttribute("style", "display:flex;flex-direction:column;gap:2px;font-size:10px;color:#a8987c");
      const cap = document.createElement("span");
      cap.textContent = f.toUpperCase();
      const inp = document.createElement("input");
      inp.type = "number";
      inp.value = String(Math.round(e.slot[f]));
      inp.setAttribute("style", "background:#14100c;color:#e8dcc8;border:1px solid #4a3320;border-radius:4px;padding:4px;width:100%;font-size:11px");
      inp.oninput = (): void => {
        const v = Number(inp.value);
        if (!Number.isFinite(v)) return;
        e.slot[f] = v;
        apply(e);
        scheduleSave();
      };
      lab.append(cap, inp);
      grid.appendChild(lab);
    });
    panel.appendChild(grid);
  }
}

/** 게임 화면 위에 에디터를 얹는다. main이 부트 직후 한 번 부른다. */
export function mountLayoutEditor(stage: Container): void {
  if (!on) return;

  const layer = new Container();
  layer.label = "layout-editor";
  stage.addChild(layer);

  shield = new Graphics().rect(-2000, -2000, 6000, 6000).fill({ color: 0x000000, alpha: 0 });
  shield.eventMode = "static";
  layer.addChild(shield);

  outline = new Graphics();
  layer.addChild(outline);

  // 항상 맨 위에 있어야 한다 — 화면이 새 레이어를 붙이면 그 아래로 묻힌다
  setInterval(() => { stage.setChildIndex(layer, stage.children.length - 1); }, 400);

  panel = document.createElement("div");
  panel.setAttribute("style",
    "position:fixed;right:12px;top:12px;width:300px;z-index:9999;background:#241a10ee;border:1px solid #4a3320;"
    + "border-radius:10px;padding:12px;font:12px/1.5 system-ui,-apple-system,sans-serif;color:#e8dcc8");
  document.body.appendChild(panel);

  // ── 드래그 ────────────────────────────────
  let dragging: Entry | null = null;
  let startX = 0, startY = 0, ox = 0, oy = 0;

  shield.on("pointerdown", (ev) => {
    const p = ev.getLocalPosition(layer);
    // 겹치면 더 작은 항목을 고른다 — 큰 배경이 작은 버튼을 늘 가로채면 편집할 수가 없다
    const hit = live()
      .filter((e) => p.x >= e.slot.x && p.x <= e.slot.x + e.slot.w
        && p.y >= stageTop() + e.slot.y && p.y <= stageTop() + e.slot.y + e.slot.h)
      .sort((a, b) => a.slot.w * a.slot.h - b.slot.w * b.slot.h)[0];
    if (!hit) return;
    dragging = hit;
    selected = key(hit.area, hit.slot.id);
    startX = p.x; startY = p.y;
    ox = hit.slot.x; oy = hit.slot.y;
    drawOutline();
    renderPanel();
  });
  shield.on("pointermove", (ev) => {
    if (!dragging) return;
    const p = ev.getLocalPosition(layer);
    dragging.slot.x = Math.round(ox + (p.x - startX));
    dragging.slot.y = Math.round(oy + (p.y - startY));
    apply(dragging);
    renderPanel();
  });
  const stop = (): void => {
    if (!dragging) return;
    dragging = null;
    scheduleSave();
  };
  shield.on("pointerup", stop);
  shield.on("pointerupoutside", stop);

  // 화면이 바뀌면 목록도 바뀐다 — 등록은 화면이 하므로 주기적으로 다시 그린다
  setInterval(renderPanel, 700);
  renderPanel();
}
