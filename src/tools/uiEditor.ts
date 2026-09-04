// tools/uiEditor.ts — UI 에디터 (dev 전용, /ui.html).
//
// 한 페이지에서 **배치**와 **에셋 업로드**를 함께 한다. 탭으로 영역이 갈린다:
//   로비 · 인게임 · 설정창  — 좌표가 있는 슬롯. 스테이지에서 끌어 옮긴다
//   게임 에셋              — 자리가 코드에 고정된 것들(타일·동물·배경). 업로드만
//
// 업로드 후 이 탭은 **리로드하지 않고 제자리 갱신**한다. 리로드가 겹치면 방금 올린
// 이미지 요청이 중단돼 「미업로드」로 오탐한다. 게임 탭만 ws 이벤트로 새로 뜬다.
//
// uiLayout.json·assets.json은 vite watch에서 빠져 있다 — 번들 모듈이 옛 내용일 수
// 있으므로 그리기 전에 디스크와 맞춘다(GET /__uilayout · /__assets).
import { uiAreas, uiUploads, uiVideos, type UiArea, type UiSlot, type UiUpload } from "../data/uiLayout";
import assetsJson from "../data/assets.json";
import { createHistory, restoreInto, type History } from "../ui/layoutHistory";

const W = 450;
const H = 800;
const SCALE = 0.8;
const VID_EXTS = ["mp4", "webm", "mov"];

/** 투명 PNG 확인용 체커보드 — 알파가 있는지 눈으로 알 수 있어야 한다. */
const CHECKER =
  "background-image:linear-gradient(45deg,#2b1d10 25%,transparent 25%),linear-gradient(-45deg,#2b1d10 25%,transparent 25%),"
  + "linear-gradient(45deg,transparent 75%,#2b1d10 75%),linear-gradient(-45deg,transparent 75%,#2b1d10 75%);"
  + "background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;background-color:#191309";

interface State {
  areas: UiArea[];
  uploads: UiUpload[];
  videos: UiUpload[];
  manifest: Record<string, unknown>;
  areaIndex: number;
  /** 위치가 없는 게임 에셋 목록을 보고 있는가 */
  assetsTab: boolean;
  /** 영상 목록을 보고 있는가 */
  videoTab: boolean;
  selected: string | null;
  dirty: boolean;
}

const state: State = {
  areas: uiAreas.map((a) => ({ ...a, slots: a.slots.map((s) => ({ ...s })) })),
  uploads: [...uiUploads],
  videos: [...uiVideos],
  manifest: assetsJson as unknown as Record<string, unknown>,
  areaIndex: 0,
  assetsTab: false,
  videoTab: false,
  selected: null,
  dirty: false,
};

const $ = (tag: string, style: string, text = ""): HTMLElement => {
  const el = document.createElement(tag);
  el.setAttribute("style", style);
  if (text) el.textContent = text;
  return el;
};

// ── 매니페스트 읽기·쓰기 ─────────────────────
function assetValue(dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, k) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[k];
  }, state.manifest as unknown);
}

/** 대표 경로 — 시퀀스면 첫 프레임. 미리보기와 스테이지 배경에 쓴다. */
function assetPath(dotted: string): string | null {
  const v = assetValue(dotted);
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : null;
  return typeof v === "string" ? v : null;
}

/** 시퀀스면 프레임 수, 스틸이면 1. */
function frameCount(dotted: string): number {
  const v = assetValue(dotted);
  return Array.isArray(v) ? v.length : 1;
}
function setAssetPath(dotted: string, value: string | string[]): void {
  const keys = dotted.split(".");
  let cur = state.manifest;
  for (const k of keys.slice(0, -1)) {
    const next = cur[k];
    if (next === null || typeof next !== "object") return;
    cur = next as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]!] = value;
}

const isVideo = (file: string): boolean => VID_EXTS.some((e) => file.split("?")[0]!.endsWith(`.${e}`));

// ── 레이아웃 ────────────────────────────────
const app = document.getElementById("app")!;
app.setAttribute("style", "font:13px/1.5 system-ui,-apple-system,sans-serif;color:#e8dcc8;padding:16px 20px");

const openInGame = $("a", "display:inline-block;background:#2b1d10;color:#f0c96a;border:1px solid #4a3320;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;text-decoration:none;margin-top:8px",
  "🎮 게임 화면에서 편집 열기");
(openInGame as HTMLAnchorElement).href = "/?editor=1";
(openInGame as HTMLAnchorElement).target = "_blank";

const head = $("div", "margin-bottom:12px");
head.append(
  $("div", "font-size:19px;font-weight:800", "🎛 UI 에디터"),
  $("div", "color:#a8987c;font-size:12px;margin-top:2px",
    "사각형을 끌어 옮기고 모서리로 크기 조정 · 카드를 클릭하거나 파일을 떨어뜨리면 업로드 · 업로드는 즉시 게임에 반영"),
  openInGame,
);
const tabs = $("div", "display:flex;gap:6px;margin:12px 0;flex-wrap:wrap");
const body = $("div", "display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap");
const stageWrap = $("div", `position:relative;width:${W * SCALE}px;height:${H * SCALE}px;background:#241a10;border:2px solid #c98a3c;flex:0 0 auto;overflow:hidden`);
const side = $("div", "flex:1 1 380px;min-width:340px;max-width:560px");
body.append(stageWrap, side);
app.append(head, tabs, body);

const list = $("div", "display:flex;flex-direction:column;gap:3px;margin-bottom:12px;max-height:220px;overflow:auto");
const detail = $("div", "");
const actions = $("div", "display:flex;gap:8px;align-items:center;margin-bottom:12px");
const saveBtn = $("button", "background:#3faa48;color:#fff;border:0;border-radius:6px;padding:9px 18px;font-weight:800;cursor:pointer;font-size:13px", "배치 저장");
const undoBtn = $("button", "", "↩ 되돌리기");
const redoBtn = $("button", "", "↪ 다시");
undoBtn.title = "⌘Z";
redoBtn.title = "⇧⌘Z";
undoBtn.onclick = (): void => applySnapshot(history?.undo() ?? null);
redoBtn.onclick = (): void => applySnapshot(history?.redo() ?? null);

function paintHistButtons(): void {
  for (const [b, ok] of [[undoBtn, history?.canUndo() === true], [redoBtn, history?.canRedo() === true]] as const) {
    (b as HTMLButtonElement).disabled = !ok;
    b.setAttribute("style",
      "border:1px solid #4a3320;border-radius:6px;padding:9px 12px;font-weight:700;font-size:12px;"
      + `background:${ok ? "#2b1d10" : "#1c150d"};color:${ok ? "#e8dcc8" : "#6b5c46"};cursor:${ok ? "pointer" : "default"}`);
  }
}
const status = $("span", "color:#a8987c;font-size:12px");
actions.append(saveBtn, undoBtn, redoBtn, status);
side.append(actions, list, detail);

const area = (): UiArea => state.areas[state.areaIndex]!;

/** 되돌리기·다시. 배치만 다룬다 — 업로드는 파일이 이미 디스크에 있으므로 되돌리지 않는다. */
let history: History<UiArea[]> | null = null;
const commit = (): void => { history?.record(state.areas); paintHistButtons(); };

function applySnapshot(snap: UiArea[] | null): void {
  if (!snap) return;
  restoreInto(state.areas as never, snap as never);
  markDirty();
  renderAll();
}
const markDirty = (): void => {
  state.dirty = true;
  status.textContent = "배치 저장 안 됨";
  status.style.color = "#f0c96a";
};

// ── 업로드 카드 ─────────────────────────────
/** 슬롯 하나의 카드. 미리보기 + 클릭/드롭 업로드 + 삭제.
 *  업로드 성공 뒤에도 파일 쓰기가 끝나기 전 요청이 갈 수 있으므로 몇 번 재시도한다. */
function card(label: string, dotted: string, onChanged?: () => void, seq = false): HTMLElement {
  const cell = $("div", "background:#241a10;border:2px solid #4a3320;border-radius:12px;overflow:hidden;cursor:pointer");
  const stage = $("div", `position:relative;height:140px;${CHECKER};display:flex;align-items:center;justify-content:center`);
  const img = document.createElement("img");
  img.setAttribute("style", "max-width:86%;max-height:86%;object-fit:contain");
  const empty = $("span", "position:absolute;display:none;color:#7a6a52;font-size:12px", "미업로드 — 클릭해서 추가");
  const del = $("span", "position:absolute;top:6px;right:6px;background:#000c;color:#ff9db8;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800", "🗑");
  stage.append(img, empty, del);

  const info = $("div", "padding:9px 12px");
  const name = $("div", "font-weight:800;font-size:13px", seq ? `${label}  🎞` : label);
  const meta = $("div", "font-size:11px;color:#a8987c;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap");
  info.append(name, meta);
  cell.append(stage, info);

  const showVideo = (src: string): void => {
    img.style.display = "none";
    empty.style.display = "none";
    stage.querySelector("video")?.remove();
    const v = document.createElement("video");
    v.src = src;
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%;object-fit:contain");
    stage.prepend(v);
  };

  const paint = (): void => {
    const rel = assetPath(dotted);
    const n = frameCount(dotted);
    meta.textContent = rel ? (seq && n > 1 ? `${n}프레임 · ${rel}` : rel) : "(매니페스트에 없음)";
    meta.style.color = "#a8987c";
    if (!rel) { img.style.display = "none"; empty.style.display = "block"; return; }
    if (isVideo(rel)) { showVideo(`${rel}?v=${Date.now()}`); return; }
    stage.querySelector("video")?.remove();
    img.dataset["src"] = rel;
    img.dataset["retries"] = "1";
    img.src = `${rel}?v=${Date.now()}`;
  };
  img.onload = (): void => { img.style.display = ""; empty.style.display = "none"; };
  img.onerror = (): void => {
    const left = Number(img.dataset["retries"] ?? "0");
    if (left > 0) {
      // 업로드 직후에는 쓰기가 끝나기 전 요청이 갈 수 있다 — 잠깐 뒤 다시 시도한다
      img.dataset["retries"] = String(left - 1);
      setTimeout(() => { img.src = `${img.dataset["src"]}?v=${Date.now()}`; }, 600);
      return;
    }
    img.style.display = "none";
    empty.style.display = "block";
  };

  const upload = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    // 시퀀스는 **파일 이름 순**으로 재생된다 — 고른 순서는 브라우저마다 다르다
    const list = seq ? [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : [files[0]!];
    cell.style.opacity = "0.5";
    try {
      const written: string[] = [];
      for (let i = 0; i < list.length; i += 1) {
        const f = list[i]!;
        const raw = (f.name.split(".").pop() ?? "").toLowerCase();
        const ext = raw === "jpeg" ? "jpg" : raw;
        const q = seq ? `&seq=${i}&total=${list.length}` : "";
        meta.textContent = seq ? `올리는 중… ${i + 1}/${list.length}` : "올리는 중…";
        meta.style.color = "#a8987c";
        const res = await fetch(`/__upload?asset=${encodeURIComponent(dotted)}&ext=${encodeURIComponent(ext)}${q}`, {
          method: "POST", headers: { "content-type": "application/octet-stream" }, body: await f.arrayBuffer(),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text);
        // 서버가 최종 경로를 돌려준다 — 후처리로 확장자가 바뀌므로 추측하면 어긋난다
        written.push((JSON.parse(text) as { file: string }).file);
      }
      setAssetPath(dotted, seq ? written : written[0]!);
      img.dataset["retries"] = "6"; // 업로드 성공 = 파일 존재 보장 → 폴링으로 반드시 표시
      paint();
      meta.textContent = seq ? `${written.length}프레임 · ${written[0]}` : written[0]!;
      meta.style.color = "#8fdc8f";
      onChanged?.();
    } catch (err) {
      meta.textContent = `실패: ${String(err)}`;
      meta.style.color = "#ff8f7a";
    }
    cell.style.opacity = "1";
  };

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,audio/*";
  input.multiple = seq; // 시퀀스 슬롯은 여러 장을 한 번에 받는다
  input.style.display = "none";
  input.onchange = (): void => { void upload([...(input.files ?? [])]); input.value = ""; };
  cell.appendChild(input);
  cell.onclick = (): void => input.click();
  cell.ondragover = (e): void => { e.preventDefault(); cell.style.borderColor = "#f0c96a"; };
  cell.ondragleave = (): void => { cell.style.borderColor = "#4a3320"; };
  cell.ondrop = (e): void => {
    e.preventDefault();
    cell.style.borderColor = "#4a3320";
    void upload([...(e.dataTransfer?.files ?? [])]);
  };
  del.onclick = async (e): Promise<void> => {
    e.stopPropagation();
    if (!confirm(`'${label}' 업로드 파일을 삭제할까요?\n빈 슬롯은 게임에서 폴백으로 그려집니다.`)) return;
    const res = await fetch(`/__upload?asset=${encodeURIComponent(dotted)}`, { method: "DELETE" });
    if (!res.ok) { alert(`삭제 실패: ${await res.text()}`); return; }
    stage.querySelector("video")?.remove();
    img.style.display = "none";
    empty.style.display = "block";
    meta.textContent = assetPath(dotted) ?? "";
    onChanged?.();
  };

  paint();
  return cell;
}

// ── 스테이지 ────────────────────────────────
function renderStage(): void {
  stageWrap.replaceChildren();
  for (const s of area().slots) {
    const on = s.id === state.selected;
    const el = $("div",
      `position:absolute;left:${s.x * SCALE}px;top:${s.y * SCALE}px;width:${s.w * SCALE}px;height:${s.h * SCALE}px;`
      + `box-sizing:border-box;cursor:move;overflow:hidden;`
      + `border:2px solid ${on ? "#f0c96a" : "rgba(102,194,255,.85)"};`
      + `background:${on ? "rgba(240,201,106,.18)" : "rgba(102,194,255,.10)"} center/contain no-repeat`);
    el.dataset["slot"] = s.id;

    // 아트가 올라간 슬롯은 그 그림을 자리에 그대로 보여준다 — 배치를 눈으로 맞출 수 있어야 한다
    const rel = s.asset ? assetPath(s.asset) : null;
    if (rel && !isVideo(rel)) el.style.backgroundImage = `url("${rel}?v=${Date.now()}")`;

    const tag = $("span", "position:absolute;left:2px;top:1px;font-size:9px;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none", s.label);
    el.appendChild(tag);
    const grip = $("div", "position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;background:#f0c96a;cursor:nwse-resize");
    el.appendChild(grip);

    attachDrag(el, grip, s);
    stageWrap.appendChild(el);
  }
}

function renderTabs(): void {
  tabs.replaceChildren();
  const mk = (label: string, on: boolean, onClick: () => void): void => {
    const b = $("button",
      `background:${on ? "#c98a3c" : "#2b1d10"};color:${on ? "#241a10" : "#e8dcc8"};border:1px solid #4a3320;border-radius:6px;padding:7px 14px;font-weight:800;cursor:pointer;font-size:13px`,
      label);
    b.onclick = onClick;
    tabs.appendChild(b);
  };
  state.areas.forEach((a, i) => {
    mk(`${a.label} (${a.slots.length})`, !state.assetsTab && !state.videoTab && i === state.areaIndex, () => {
      state.areaIndex = i; state.assetsTab = false; state.videoTab = false; state.selected = null; renderAll();
    });
  });
  mk(`게임 에셋 (${state.uploads.length})`, state.assetsTab, () => {
    state.assetsTab = true; state.videoTab = false; renderAll();
  });
  mk(`영상 (${state.videos.length})`, state.videoTab, () => {
    state.videoTab = true; state.assetsTab = false; renderAll();
  });
}

function renderList(): void {
  list.replaceChildren();
  for (const s of area().slots) {
    const on = s.id === state.selected;
    const row = $("button",
      `text-align:left;background:${on ? "#3a2a18" : "transparent"};color:#e8dcc8;border:1px solid #3a2a18;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:12px`,
      `${s.asset ? "🖼 " : "· "}${s.label}  ${Math.round(s.x)},${Math.round(s.y)}  ${Math.round(s.w)}×${Math.round(s.h)}`);
    row.onclick = (): void => { state.selected = s.id; renderAll(); };
    list.appendChild(row);
  }
}

function renderDetail(): void {
  detail.replaceChildren();
  const s = area().slots.find((x) => x.id === state.selected);
  if (!s) {
    detail.appendChild($("div", "color:#a8987c;background:#241a10;border:1px solid #4a3320;border-radius:8px;padding:12px",
      "슬롯을 고르면 숫자로 조정하고 에셋을 올릴 수 있습니다."));
    return;
  }
  const wrapper = $("div", "background:#241a10;border:1px solid #4a3320;border-radius:8px;padding:12px");
  wrapper.appendChild($("div", "font-weight:800;margin-bottom:8px", `${s.label}  (${s.id})`));

  const grid = $("div", "display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px");
  (["x", "y", "w", "h"] as const).forEach((k) => {
    const lab = $("label", "display:flex;flex-direction:column;gap:3px;font-size:11px;color:#a8987c");
    lab.appendChild($("span", "", k.toUpperCase()));
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(Math.round(s[k]));
    input.setAttribute("style", "background:#14100c;color:#e8dcc8;border:1px solid #4a3320;border-radius:4px;padding:5px;width:100%;font-size:12px");
    // 타이핑 중에는 화면만 따라가고, 값이 확정될 때 한 단계로 남긴다 —
    // 키 하나마다 기록하면 되돌리기가 글자 단위가 되어 쓸모없어진다
    input.oninput = (): void => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      s[k] = v;
      markDirty();
      renderStage();
      renderList();
    };
    input.onchange = (): void => commit();
    lab.appendChild(input);
    grid.appendChild(lab);
  });
  wrapper.appendChild(grid);

  // 토글처럼 두 장을 오가는 슬롯은 카드가 둘이다 — 켜짐과 꺼짐
  if (s.asset) wrapper.appendChild(card(s.assetOff ? `${s.label} — 켜짐` : s.label, s.asset, () => renderStage()));
  if (s.assetOff) wrapper.appendChild(card(`${s.label} — 꺼짐`, s.assetOff, () => renderStage()));
  if (!s.asset && !s.assetOff) wrapper.appendChild($("div", "color:#a8987c;font-size:11px", "이 슬롯은 아트 없이 코드가 그립니다."));

  detail.appendChild(wrapper);
}

function renderAssets(): void {
  stageWrap.style.display = "none";
  list.replaceChildren();
  detail.replaceChildren();
  const head2 = $("div", "margin-bottom:8px");
  head2.append(
    $("div", "font-weight:800", "게임 에셋"),
    $("div", "color:#a8987c;font-size:11px", "자리가 코드에 고정된 것들입니다. 올리면 게임 탭이 바로 갱신됩니다. 🎞 표시는 여러 장을 한 번에 고르면 시퀀스가 됩니다 — 파일 이름 순으로 재생합니다."),
  );
  detail.appendChild(head2);
  const grid = $("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px");
  for (const u of state.uploads) grid.appendChild(card(u.label, u.asset, undefined, u.seq === true));
  detail.appendChild(grid);
  side.style.maxWidth = "1100px";
  side.style.flexBasis = "100%";
}

function renderVideos(): void {
  stageWrap.style.display = "none";
  list.replaceChildren();
  detail.replaceChildren();
  const head2 = $("div", "margin-bottom:8px");
  head2.append(
    $("div", "font-weight:800", "영상"),
    $("div", "color:#a8987c;font-size:11px",
      "세로 화면 전체를 덮습니다. 인트로는 게임을 열 때, 엔딩은 마지막 스테이지를 깨면 재생됩니다. "
      + "mp4·webm · 자동재생 정책 때문에 무음으로 시작하고 화면의 🔇 버튼으로 소리를 켭니다. "
      + "파일이 없으면 그 단계를 건너뜁니다."),
  );
  detail.appendChild(head2);
  const grid = $("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px");
  for (const v of state.videos) grid.appendChild(card(v.label, v.asset));
  detail.appendChild(grid);
  side.style.maxWidth = "1100px";
  side.style.flexBasis = "100%";
}

function renderAll(): void {
  renderTabs();
  paintHistButtons();
  if (state.videoTab) { renderVideos(); return; }
  if (state.assetsTab) { renderAssets(); return; }
  stageWrap.style.display = "block";
  side.style.maxWidth = "560px";
  side.style.flexBasis = "380px";
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
  };
  el.addEventListener("pointerdown", (e) => down(e, "move"));
  grip.addEventListener("pointerdown", (e) => down(e, "resize"));

  window.addEventListener("pointermove", (e) => {
    if (!mode) return;
    const dx = (e.clientX - startX) / SCALE;
    const dy = (e.clientY - startY) / SCALE;
    if (mode === "move") { s.x = Math.round(ox + dx); s.y = Math.round(oy + dy); }
    else { s.w = Math.max(8, Math.round(ow + dx)); s.h = Math.max(8, Math.round(oh + dy)); }
    markDirty();
    renderStage();
    renderList();
  });
  window.addEventListener("pointerup", () => {
    if (mode) commit(); // 드래그 한 번이 되돌리기 한 단계다
    mode = null;
  });
}

// ── 저장 ────────────────────────────────────
saveBtn.onclick = async (): Promise<void> => {
  status.textContent = "저장 중…";
  status.style.color = "#a8987c";
  try {
    const res = await fetch("/__uilayout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(await currentLayout()), areas: state.areas }),
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

async function currentLayout(): Promise<Record<string, unknown>> {
  try {
    const r = await fetch("/__uilayout");
    if (r.ok) return (await r.json()) as Record<string, unknown>;
  } catch { /* dev 서버 밖 */ }
  return {};
}

window.addEventListener("beforeunload", (e) => { if (state.dirty) e.preventDefault(); });

window.addEventListener("keydown", (e) => {
  // 입력칸 안에서는 브라우저의 글자 되돌리기를 그대로 둔다
  const act = document.activeElement;
  if (act instanceof HTMLInputElement || act instanceof HTMLTextAreaElement) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    applySnapshot(e.shiftKey ? (history?.redo() ?? null) : (history?.undo() ?? null));
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    applySnapshot(history?.redo() ?? null);
  }
});

/** 그리기 전에 디스크와 맞춘다 — 두 JSON은 watch 제외라 번들 모듈이 옛 내용일 수 있다. */
async function syncFromDisk(): Promise<void> {
  try {
    const [l, a] = await Promise.all([fetch("/__uilayout"), fetch("/__assets")]);
    if (l.ok) {
      const fresh = (await l.json()) as { areas?: UiArea[]; uploads?: UiUpload[]; videos?: UiUpload[] };
      if (Array.isArray(fresh.areas)) state.areas = fresh.areas;
      if (Array.isArray(fresh.uploads)) state.uploads = fresh.uploads;
      if (Array.isArray(fresh.videos)) state.videos = fresh.videos;
    }
    if (a.ok) state.manifest = (await a.json()) as Record<string, unknown>;
  } catch { /* dev 서버 밖 — 번들 값 그대로 */ }
}

void syncFromDisk().then(() => {
  history = createHistory<UiArea[]>(state.areas); // 디스크와 맞춘 뒤가 시작점이다
  renderAll();
  status.textContent = "";
});
