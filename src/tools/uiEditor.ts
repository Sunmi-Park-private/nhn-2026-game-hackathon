// tools/uiEditor.ts — UI 배치 에디터. 한 페이지에서 영역을 탭으로 나눠 조정한다.
//
// 게임 좌표계(중앙 콘텐츠 450×800)를 그대로 화면에 띄우고, 슬롯을 사각형으로 얹는다.
// 끌어서 옮기고 모서리를 끌어서 크기를 바꾼 뒤 저장하면 src/data/uiLayout.json이 갱신된다.
// dev 서버에서만 동작한다 — 저장 엔드포인트가 vite 플러그인이다.
import { uiAreas, uiUploads, type UiArea, type UiSlot } from "../data/uiLayout";
import layoutJson from "../data/uiLayout.json";
import assetsJson from "../data/assets.json";

const W = 450;
const H = 800;
const SCALE = 0.86;

/** 화면별 배경 미리보기. 파일이 없으면 그냥 안 보인다(에러 아님). */
const AREA_BG: Record<string, string> = {
  lobby: "assets/lobby/bg.png",
  ingame: "assets/hex/bg-board.png",
  settings: "",
};

interface State {
  areas: UiArea[];
  areaIndex: number;
  selected: string | null;
  dirty: boolean;
  /** 위치가 없는 게임 에셋 목록을 보고 있는가 */
  assetsTab: boolean;
}

const state: State = {
  areas: uiAreas.map((a) => ({ ...a, slots: a.slots.map((s) => ({ ...s })) })),
  areaIndex: 0,
  selected: null,
  dirty: false,
  assetsTab: false,
};

const $ = (tag: string, style: string, text = ""): HTMLElement => {
  const el = document.createElement(tag);
  el.setAttribute("style", style);
  if (text) el.textContent = text;
  return el;
};

const app = document.getElementById("app")!;
app.setAttribute("style", "font:13px/1.5 system-ui,-apple-system,sans-serif;color:#e8dcc8;padding:16px;display:flex;gap:20px;align-items:flex-start");

// ── 좌: 스테이지 ─────────────────────────────
const stageWrap = $("div", `position:relative;width:${W * SCALE}px;height:${H * SCALE}px;background:#241a10;border:2px solid #c98a3c;flex:0 0 auto`);
const bgImg = document.createElement("img");
bgImg.setAttribute("style", `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.65`);
bgImg.onerror = (): void => { bgImg.style.display = "none"; };
stageWrap.appendChild(bgImg);

// ── 우: 패널 ────────────────────────────────
const panel = $("div", "flex:1 1 auto;min-width:280px;max-width:420px");
const tabs = $("div", "display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap");
const list = $("div", "display:flex;flex-direction:column;gap:4px;margin-bottom:14px");
const detail = $("div", "background:#241a10;border:1px solid #4a3320;border-radius:8px;padding:10px;margin-bottom:12px;min-height:96px");
const actions = $("div", "display:flex;gap:8px;align-items:center");
const saveBtn = $("button", "background:#3faa48;color:#fff;border:0;border-radius:6px;padding:9px 18px;font-weight:700;cursor:pointer;font-size:13px", "저장");
const status = $("span", "color:#a8987c");
actions.append(saveBtn, status);
panel.append(
  $("div", "font-size:18px;font-weight:700;margin-bottom:4px", "UI 배치 에디터"),
  $("div", "color:#a8987c;margin-bottom:14px", "사각형을 끌어서 옮기고, 우하단 손잡이로 크기를 바꿉니다. 좌표계는 450×800."),
  tabs, list, detail, actions,
);
app.append(stageWrap, panel);

function area(): UiArea {
  return state.areas[state.areaIndex]!;
}

function markDirty(): void {
  state.dirty = true;
  status.textContent = "저장 안 됨";
  status.style.color = "#f0c96a";
}

// ── 렌더 ────────────────────────────────────
function renderTabs(): void {
  tabs.replaceChildren();
  const mk = (label: string, on: boolean, onClick: () => void): void => {
    const b = $("button",
      `background:${on ? "#c98a3c" : "#2b1d10"};color:${on ? "#241a10" : "#e8dcc8"};border:1px solid #4a3320;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer;font-size:13px`,
      label);
    b.onclick = onClick;
    tabs.appendChild(b);
  };
  state.areas.forEach((a, i) => {
    const on = i === state.areaIndex;
    const b = $("button",
      `background:${on ? "#c98a3c" : "#2b1d10"};color:${on ? "#241a10" : "#e8dcc8"};border:1px solid #4a3320;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer;font-size:13px`,
      `${a.label} (${a.slots.length})`);
    b.onclick = (): void => { state.areaIndex = i; state.assetsTab = false; state.selected = null; renderAll(); };
    tabs.appendChild(b);
  });
  mk(`게임 에셋 (${uiUploads.length})`, state.assetsTab, () => { state.assetsTab = true; renderAll(); });
}

function renderStage(): void {
  stageWrap.querySelectorAll("[data-slot]").forEach((n) => n.remove());
  bgImg.src = AREA_BG[area().id] || "";
  bgImg.style.display = AREA_BG[area().id] ? "block" : "none";

  for (const s of area().slots) {
    const on = s.id === state.selected;
    const el = $("div",
      `position:absolute;left:${s.x * SCALE}px;top:${s.y * SCALE}px;width:${s.w * SCALE}px;height:${s.h * SCALE}px;`
      + `border:2px solid ${on ? "#f0c96a" : "#66c2ff"};background:${on ? "rgba(240,201,106,.22)" : "rgba(102,194,255,.12)"};`
      + "box-sizing:border-box;cursor:move;display:flex;align-items:center;justify-content:center;overflow:hidden");
    el.dataset.slot = s.id;
    el.appendChild($("span", "font-size:10px;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none;text-align:center", s.label));

    const grip = $("div", "position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;background:#f0c96a;cursor:nwse-resize");
    el.appendChild(grip);

    attachDrag(el, grip, s);
    stageWrap.appendChild(el);
  }
}

function renderList(): void {
  list.replaceChildren();
  for (const s of area().slots) {
    const on = s.id === state.selected;
    const row = $("button",
      `text-align:left;background:${on ? "#3a2a18" : "transparent"};color:#e8dcc8;border:1px solid #3a2a18;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px`,
      `${s.label}  ·  ${Math.round(s.x)}, ${Math.round(s.y)}  ${Math.round(s.w)}×${Math.round(s.h)}`);
    row.onclick = (): void => { state.selected = s.id; renderAll(); };
    list.appendChild(row);
  }
}

/** assets.json 안의 점 경로를 읽는다. */
function assetPath(dotted: string): string | null {
  const v = dotted.split(".").reduce<unknown>((acc, k) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[k];
  }, assetsJson as unknown);
  return typeof v === "string" ? v : null;
}

/** 슬롯 하나의 업로드 줄. 현재 파일 미리보기 + 파일 고르기. */
function uploadRow(label: string, dotted: string): HTMLElement {
  const wrap = $("div", "display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid #3a2a18");
  const rel = assetPath(dotted);

  const thumb = document.createElement("div");
  thumb.setAttribute("style", "width:52px;height:52px;flex:0 0 auto;border:1px solid #4a3320;border-radius:6px;background:#14100c center/contain no-repeat");
  if (rel) thumb.style.backgroundImage = `url("${rel}")`;

  const info = $("div", "flex:1 1 auto;min-width:0");
  info.appendChild($("div", "font-weight:700;font-size:12px", label));
  const pathEl = $("div", "font-size:11px;color:#a8987c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", rel ?? "(매니페스트에 없음)");
  info.appendChild(pathEl);

  const btn = $("label", "background:#c98a3c;color:#241a10;border-radius:6px;padding:7px 12px;font-weight:700;cursor:pointer;font-size:12px;flex:0 0 auto", "업로드");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/mp4,video/webm,audio/*";
  input.style.display = "none";
  btn.appendChild(input);

  input.onchange = async (): Promise<void> => {
    const file = input.files?.[0];
    if (!file) return;
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    pathEl.textContent = "올리는 중…";
    try {
      const res = await fetch(`/__upload?asset=${encodeURIComponent(dotted)}&ext=${encodeURIComponent(ext)}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: await file.arrayBuffer(),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      const out = JSON.parse(text) as { file: string; bytes: number };
      // 같은 경로에 덮어써도 새 그림이 보이도록 캐시를 우회한다
      thumb.style.backgroundImage = `url("${out.file}?t=${Date.now()}")`;
      pathEl.textContent = `${out.file}  ·  ${Math.round(out.bytes / 1024)}KB`;
      pathEl.style.color = "#8fdc8f";
    } catch (err) {
      pathEl.textContent = `실패: ${String(err)}`;
      pathEl.style.color = "#ff8f7a";
    }
    input.value = "";
  };

  wrap.append(thumb, info, btn);
  return wrap;
}

function renderDetail(): void {
  detail.replaceChildren();
  const s = area().slots.find((x) => x.id === state.selected);
  if (!s) {
    detail.appendChild($("div", "color:#a8987c", "슬롯을 고르면 숫자로 조정하고 에셋을 올릴 수 있습니다."));
    return;
  }
  detail.appendChild($("div", "font-weight:700;margin-bottom:8px", `${s.label}  (${s.id})`));
  const grid = $("div", "display:grid;grid-template-columns:repeat(4,1fr);gap:8px");
  (["x", "y", "w", "h"] as const).forEach((k) => {
    const wrap = $("label", "display:flex;flex-direction:column;gap:3px;font-size:11px;color:#a8987c");
    wrap.appendChild($("span", "", k.toUpperCase()));
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(Math.round(s[k]));
    input.setAttribute("style", "background:#14100c;color:#e8dcc8;border:1px solid #4a3320;border-radius:4px;padding:5px;width:100%;font-size:12px");
    input.oninput = (): void => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      s[k] = v;
      markDirty();
      renderStage();
      renderList();
    };
    wrap.appendChild(input);
    grid.appendChild(wrap);
  });
  detail.appendChild(grid);

  if (s.asset) detail.appendChild(uploadRow(s.label, s.asset));
  else detail.appendChild($("div", "color:#a8987c;font-size:11px;padding-top:8px;border-top:1px solid #3a2a18;margin-top:8px", "이 슬롯은 아트 없이 코드가 그립니다."));
}

function renderAll(): void {
  renderTabs();
  if (state.assetsTab) {
    stageWrap.style.display = "none";
    list.replaceChildren();
    detail.replaceChildren();
    detail.appendChild($("div", "font-weight:700;margin-bottom:6px", "게임 에셋"));
    detail.appendChild($("div", "color:#a8987c;font-size:11px;margin-bottom:6px", "자리가 코드에 고정된 것들입니다. 올리면 게임 탭이 바로 새로고침됩니다."));
    for (const u of uiUploads) detail.appendChild(uploadRow(u.label, u.asset));
    return;
  }
  stageWrap.style.display = "block";
  renderStage();
  renderList();
  renderDetail();
}

// ── 드래그 ──────────────────────────────────
function attachDrag(el: HTMLElement, grip: HTMLElement, s: UiSlot): void {
  let mode: "move" | "resize" | null = null;
  let startX = 0, startY = 0, ox = 0, oy = 0, ow = 0, oh = 0;

  const down = (e: PointerEvent, m: "move" | "resize"): void => {
    e.preventDefault();
    e.stopPropagation();
    mode = m;
    startX = e.clientX; startY = e.clientY;
    ox = s.x; oy = s.y; ow = s.w; oh = s.h;
    state.selected = s.id;
    renderAll();
    el.setPointerCapture?.(e.pointerId);
  };
  el.addEventListener("pointerdown", (e) => down(e, "move"));
  grip.addEventListener("pointerdown", (e) => down(e, "resize"));

  window.addEventListener("pointermove", (e) => {
    if (!mode) return;
    const dx = (e.clientX - startX) / SCALE;
    const dy = (e.clientY - startY) / SCALE;
    if (mode === "move") {
      s.x = Math.round(ox + dx);
      s.y = Math.round(oy + dy);
    } else {
      s.w = Math.max(8, Math.round(ow + dx));
      s.h = Math.max(8, Math.round(oh + dy));
    }
    markDirty();
    renderStage();
    renderList();
    renderDetail();
  });
  window.addEventListener("pointerup", () => { mode = null; });
}

// ── 저장 ────────────────────────────────────
saveBtn.onclick = async (): Promise<void> => {
  status.textContent = "저장 중…";
  status.style.color = "#a8987c";
  const body = { ...(layoutJson as object), areas: state.areas };
  try {
    const res = await fetch("/__uilayout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    state.dirty = false;
    status.textContent = "저장됨";
    status.style.color = "#8fdc8f";
  } catch (err) {
    status.textContent = `실패: ${String(err)}`;
    status.style.color = "#ff8f7a";
  }
};

window.addEventListener("beforeunload", (e) => {
  if (state.dirty) e.preventDefault();
});

renderAll();
status.textContent = "";
