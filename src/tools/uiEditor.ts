// tools/uiEditor.ts — UI 에디터 (dev 전용, /ui.html).
//
// 한 페이지에서 **배치**와 **에셋 업로드**를 함께 한다. 탭으로 영역이 갈린다:
//   로비 · 인게임 · 설정창  — 좌표가 있는 슬롯. 스테이지에서 끌어 옮긴다
//                            (로비에는 배경 영상 6칸 묶음 업로드가 아래에 더 붙는다)
//   게임 에셋              — 자리가 코드에 고정된 것들(타일·동물·배경). 업로드만
//   영상 · 오디오          — 화면 전체 영상, BGM·효과음. 업로드만
//
// 업로드 후 이 탭은 **리로드하지 않고 제자리 갱신**한다. 리로드가 겹치면 방금 올린
// 이미지 요청이 중단돼 「미업로드」로 오탐한다. 게임 탭만 ws 이벤트로 새로 뜬다.
//
// uiLayout.json·assets.json은 vite watch에서 빠져 있다 — 번들 모듈이 옛 내용일 수
// 있으므로 그리기 전에 디스크와 맞춘다(GET /__uilayout · /__assets).
import { uiAreas, uiUploads, uiVideos, uiAudios, sameAreas, parseAreas, type UiArea, type UiSlot, type UiUpload } from "../data/uiLayout";
import assetsJson from "../data/assets.json";
import { frameIndex } from "../data/hexAssets";
import { createHistory, restoreInto, type History } from "../ui/layoutHistory";
import { hasEditorServer, NO_EDITOR_SERVER } from "../ui/editorServer";

const W = 450;
const H = 800;
const SCALE = 0.8;
const VID_EXTS = ["mp4", "webm", "mov"];
const AUD_EXTS = ["mp3", "wav", "ogg", "m4a"];

/** 투명 PNG 확인용 체커보드 — 알파가 있는지 눈으로 알 수 있어야 한다. */
const CHECKER =
  "background-image:linear-gradient(45deg,#2b1d10 25%,transparent 25%),linear-gradient(-45deg,#2b1d10 25%,transparent 25%),"
  + "linear-gradient(45deg,transparent 75%,#2b1d10 75%),linear-gradient(-45deg,transparent 75%,#2b1d10 75%);"
  + "background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;background-color:#191309";

interface State {
  areas: UiArea[];
  uploads: UiUpload[];
  videos: UiUpload[];
  audios: UiUpload[];
  manifest: Record<string, unknown>;
  areaIndex: number;
  /** 위치가 없는 게임 에셋 목록을 보고 있는가 */
  assetsTab: boolean;
  /** 영상 목록을 보고 있는가 */
  videoTab: boolean;
  /** 오디오 목록을 보고 있는가 */
  audioTab: boolean;
  selected: string | null;
  dirty: boolean;
  /** 디스크에 있다고 믿는 배치. 배너를 띄울지 판단할 때 쓴다 */
  baseline: UiArea[];
  /** 그 배치를 읽어 온 시점의 서버 리비전. 저장할 때 함께 보내면 서버가 판정한다 */
  rev: string;
}

const state: State = {
  areas: uiAreas.map((a) => ({ ...a, slots: a.slots.map((s) => ({ ...s })) })),
  uploads: [...uiUploads],
  videos: [...uiVideos],
  audios: [...uiAudios],
  manifest: assetsJson as unknown as Record<string, unknown>,
  areaIndex: 0,
  assetsTab: false,
  videoTab: false,
  audioTab: false,
  selected: null,
  dirty: false,
  baseline: uiAreas.map((a) => ({ ...a, slots: a.slots.map((sl) => ({ ...sl })) })),
  rev: "",
};

/** 이 탭의 표식. 서버가 저장 알림에 실어 돌려주므로 자기 메아리를 걸러낼 수 있다. */
const CLIENT_ID = `ui-${Math.random().toString(36).slice(2)}`;

const cloneAreas = (areas: readonly UiArea[]): UiArea[] =>
  areas.map((a) => ({ ...a, slots: (a.slots ?? []).map((sl) => ({ ...sl })) }));

/** 지금 슬롯을 끌고 있는 손가락 수. 0보다 크면 화면을 갈아끼우지 않는다 —
 *  끌던 슬롯 객체가 화면에서 떨어져 나가면 그 뒤 pointermove가 유령을 고친다.
 *
 *  **0으로 돌아오지 못하면 catchUp이 영영 멈춘다** — 이 PR이 고치려는 버그가
 *  그대로 되살아난다. 창 밖에서 손을 떼면 pointerup이 이 페이지로 오지 않으므로
 *  pointercancel과 창 blur에서도 반드시 푼다. */
let dragging = 0;

/** catchUp 요청 표. 늦게 떠난 응답이 먼저 온 응답을 덮지 않게 한다 —
 *  ws·visibilitychange·focus 셋이 겹쳐 부르므로 실제로 엇갈린다. */
let pullSeq = 0;

/** 저장이 날아가 있는 동안 또 누르지 못하게 한다. 두 번 누르면 같은 rev로 두 번
 *  POST해서 둘째가 검사에 걸리고, 일어나지도 않은 충돌을 배너로 알리며
 *  이미 맞는 값을 강제로 덮어쓰라고 권하게 된다. */
let saving = false;

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
function setAssetPath(dotted: string, value: string | string[] | number): void {
  const keys = dotted.split(".");
  let cur = state.manifest;
  for (const k of keys.slice(0, -1)) {
    const next = cur[k];
    if (next === null || typeof next !== "object") return;
    cur = next as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]!] = value;
}

const hasExt = (file: string, exts: string[]): boolean => exts.some((e) => file.split("?")[0]!.endsWith(`.${e}`));
const isVideo = (file: string): boolean => hasExt(file, VID_EXTS);
const isAudio = (file: string): boolean => hasExt(file, AUD_EXTS);

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
// 빌드본(npm run share)에서 /ui.html을 열면 저장·업로드 서버가 없다. 카드마다
// 「실패: SyntaxError …」가 뜨기 전에 맨 위에서 한 번 말한다.
if (!hasEditorServer()) {
  head.prepend($("div",
    "background:#4a1f18;color:#ffb3a3;border:1px solid #ff8f7a;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-weight:700",
    `⚠ ${NO_EDITOR_SERVER}`));
}

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

/** 게임 화면에서 배치가 바뀌었는데 여기 저장 안 된 변경이 있을 때만 뜬다.
 *  어느 쪽을 버릴지는 사람이 고른다 — 코드가 말없이 고르면 한쪽 작업이 사라진다. */
const conflict = $("div",
  "display:none;background:#3a2a18;border:1px solid #c98a3c;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px");
const conflictText = $("div", "color:#f0c96a;font-weight:700;margin-bottom:7px");
const reloadBtn = $("button",
  "background:#c98a3c;color:#241a10;border:0;border-radius:6px;padding:6px 12px;font-weight:800;cursor:pointer;font-size:12px",
  "새로 읽기");
// 버리는 쪽만 주면 그건 선택이 아니라 막다른 길이다 — 여기서 한 작업을
// 살리려면 배너를 무시하는 수밖에 없게 된다
const overwriteBtn = $("button",
  "background:#2b1d10;color:#e8dcc8;border:1px solid #4a3320;border-radius:6px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:12px;margin-left:6px",
  "이쪽 값으로 덮어쓰기");
conflict.append(conflictText, reloadBtn, overwriteBtn);
/** 고른 슬롯과 별개로, 그 영역 전체에 걸린 묶음 업로드가 들어가는 자리. */
const extras = $("div", "margin-top:12px");
side.append(actions, conflict, list, detail, extras);

const area = (): UiArea => state.areas[state.areaIndex]!;

/** 로비 배경 영상. 이 접두사를 쓰는 슬롯을 한 판에 모아 올린다 —
 *  6칸을 하나씩 골라 들어가지 않고 타일처럼 한자리에서 끝내려는 것이다. */
const SCENE_PREFIX = "lobby.friends.";

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
function card(label: string, dotted: string, onChanged?: () => void, seq = false, holdKey?: string): HTMLElement {
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

  const clearMedia = (): void => { stage.querySelector("video")?.remove(); stage.querySelector("audio")?.remove(); };

  const showVideo = (src: string): void => {
    img.style.display = "none";
    empty.style.display = "none";
    clearMedia();
    const v = document.createElement("video");
    v.src = src;
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%;object-fit:contain");
    stage.prepend(v);
  };

  /** 소리는 볼 것이 없다 — 재생기를 놓아 귀로 확인한다. */
  const showAudio = (src: string): void => {
    img.style.display = "none";
    empty.style.display = "none";
    clearMedia();
    const a = document.createElement("audio");
    a.src = src;
    a.controls = true;
    a.preload = "metadata";
    a.setAttribute("style", "width:86%");
    // 매니페스트에 경로만 있고 파일이 없는 슬롯이 태반이다 — 재생기가 아니라
    // 「미업로드」로 보여야 무엇이 비었는지 한눈에 안다
    a.onerror = (): void => { a.remove(); empty.style.display = "block"; };
    stage.prepend(a);
  };

  // hold 슬롯이 붙으면 프레임 눈금을 다시 맞춘다. 없으면 아무 일도 없다.
  let afterPaint: (() => void) | null = null;

  const paint = (): void => {
    const rel = assetPath(dotted);
    const n = frameCount(dotted);
    meta.textContent = rel ? (seq && n > 1 ? `${n}프레임 · ${rel}` : rel) : "(매니페스트에 없음)";
    meta.style.color = "#a8987c";
    if (!rel) { img.style.display = "none"; clearMedia(); empty.style.display = "block"; afterPaint?.(); return; }
    if (isVideo(rel)) { showVideo(`${rel}?v=${Date.now()}`); afterPaint?.(); return; }
    if (isAudio(rel)) { showAudio(`${rel}?v=${Date.now()}`); afterPaint?.(); return; }
    clearMedia();
    img.dataset["src"] = rel;
    img.dataset["retries"] = "1";
    img.src = `${rel}?v=${Date.now()}`;
    afterPaint?.();
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
      if (!hasEditorServer()) throw new Error(NO_EDITOR_SERVER);
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
  input.accept = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4";
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
    if (!hasEditorServer()) { meta.textContent = `실패: ${NO_EDITOR_SERVER}`; meta.style.color = "#ff8f7a"; return; }
    if (!confirm(`'${label}' 업로드 파일을 삭제할까요?\n빈 슬롯은 게임에서 폴백으로 그려집니다.`)) return;
    const res = await fetch(`/__upload?asset=${encodeURIComponent(dotted)}`, { method: "DELETE" });
    if (!res.ok) { alert(`삭제 실패: ${await res.text()}`); return; }
    clearMedia();
    img.style.display = "none";
    empty.style.display = "block";
    meta.textContent = assetPath(dotted) ?? "";
    onChanged?.();
  };

  // ── 최대 장전 프레임 (붉은말처럼 hold가 지정된 시퀀스에만) ──
  // 한 시퀀스에 「당김 → 폄」이 다 들어 있어, 어디까지가 당김인지 코드가 알아야 한다.
  if (holdKey) {
    const bar = $("div", "padding:0 12px 10px");
    const readHold = (): number => {
      const v = assetValue(holdKey);
      return typeof v === "number" && Number.isInteger(v) ? v : 0;
    };
    const label2 = $("div", "font-size:11px;color:#a8987c;margin-bottom:4px");
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.step = "1";
    range.setAttribute("style", "width:100%");
    const set = $("button",
      "margin-top:6px;background:#2b1d10;color:#f0c96a;border:1px solid #4a3320;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer",
      "이 프레임을 최대 장전으로");

    /** 매니페스트의 프레임 목록. 스크러버는 이 배열을 훑는다. */
    const frameList = (): string[] => {
      const v = assetValue(dotted);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    };

    /** 슬라이더가 가리키는 프레임을 그대로 보여 준다 — oninput과 syncBar가 같은 동작을 쓴다. */
    const showFrame = (list: string[]): void => {
      const f = list[Number(range.value)];
      if (f) { img.dataset["retries"] = "1"; img.src = `${f}?v=${Date.now()}`; }
    };

    const syncBar = (): void => {
      const list = frameList();
      if (list.length === 0) { bar.style.display = "none"; return; }
      bar.style.display = "";
      range.max = String(list.length - 1);
      // 저장된 값이 지금 프레임 수를 벗어나면(짧아진 시퀀스로 교체된 경우)
      // 게임 코드(frameIndex)와 같은 규칙으로 되돌린다 — 다른 판단을 만들지 않는다
      const hold = frameIndex(readHold(), list.length);
      range.value = String(hold);
      label2.textContent = `최대 장전: ${hold}번 프레임 / 전체 ${list.length}장 — 앞은 당김, 뒤는 토스`;
      showFrame(list);
    };

    range.oninput = (): void => { showFrame(frameList()); };
    set.onclick = async (): Promise<void> => {
      if (!hasEditorServer()) { label2.style.color = "#ff8f7a"; label2.textContent = `저장 실패: ${NO_EDITOR_SERVER}`; return; }
      setAssetPath(holdKey, Number(range.value));
      const res = await fetch("/__assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state.manifest),
      });
      label2.style.color = res.ok ? "#8fdc8f" : "#ff8f7a";
      if (res.ok) syncBar(); else label2.textContent = `저장 실패: ${await res.text()}`;
    };

    bar.append(label2, range, set);
    cell.appendChild(bar);
    syncBar();
    // 업로드로 프레임 수가 바뀌면 눈금도 따라가야 한다
    afterPaint = syncBar;
  }

  paint();
  return cell;
}

// ── 스테이지 ────────────────────────────────
function renderStage(): void {
  stageWrap.replaceChildren();
  for (const s of area().slots) {
    // 배경 영상 슬롯은 스테이지에 그리지 않는다. 화면 전체(0,0,450,800)를 차지해
    // **다른 슬롯을 전부 덮고 클릭을 가로챈다** — PLAY도 설정도 고를 수 없게 된다.
    // 좌표를 쓰지 않는 자리라 끌어 맞출 것도 없다. 업로드는 아래 묶음 판에서 한다.
    if (s.asset?.startsWith(SCENE_PREFIX) === true) continue;
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
  const mk = (label: string, on: boolean, onClick: () => void, lockedWhy?: string): void => {
    const b = $("button",
      lockedWhy !== undefined
        ? "background:#1d150c;color:#6b5a44;border:1px dashed #3a2b1a;border-radius:6px;padding:7px 14px;font-weight:800;cursor:not-allowed;font-size:13px;text-decoration:line-through"
        : `background:${on ? "#c98a3c" : "#2b1d10"};color:${on ? "#241a10" : "#e8dcc8"};border:1px solid #4a3320;border-radius:6px;padding:7px 14px;font-weight:800;cursor:pointer;font-size:13px`,
      label);
    if (lockedWhy !== undefined) {
      b.title = lockedWhy;
      (b as HTMLButtonElement).disabled = true;
    } else {
      b.onclick = onClick;
    }
    tabs.appendChild(b);
  };
  // 탭 상태가 boolean 여러 개라 켤 때 나머지를 반드시 끈다 — 하나라도 빠지면 두 탭이 함께 켜진다
  const only = (which: "assets" | "video" | "audio" | null): void => {
    state.assetsTab = which === "assets";
    state.videoTab = which === "video";
    state.audioTab = which === "audio";
  };
  const onArea = !state.assetsTab && !state.videoTab && !state.audioTab;
  state.areas.forEach((a, i) => {
    mk(`${a.label} (${a.slots.length})`, onArea && i === state.areaIndex, () => {
      state.areaIndex = i; only(null); state.selected = null; renderAll();
    }, a.disabled === true ? "게임에서 들어갈 길이 없는 화면입니다. 좌표는 지우지 않고 남겨 뒀습니다." : undefined);
  });
  mk(`게임 에셋 (${state.uploads.length})`, state.assetsTab, () => { only("assets"); renderAll(); });
  mk(`영상 (${state.videos.length})`, state.videoTab, () => { only("video"); renderAll(); });
  mk(`오디오 (${state.audios.length})`, state.audioTab, () => { only("audio"); renderAll(); });
}

/** 영역 탭 아래에 함께 뜨는 업로드 묶음.
 *
 *  두 종류가 있다. 하나는 **슬롯에 붙은 것**(로비 배경 영상 — 접두사로 모은다),
 *  다른 하나는 **자리가 코드에 고정된 것**(레이스 배경·러너 — 「게임 에셋」 탭에 다 모여
 *  있지만 그 탭이 지금 44개다). 그 화면을 만드는 사람이 자기 화면의 에셋을 거기서 찾아
 *  헤매지 않도록 **영역 탭에서 바로 올릴 수 있게** 같은 항목을 여기에도 띄운다(같은 슬롯이다). */
const AREA_UPLOAD_GROUPS: Record<string, { groups: string[]; note: string }> = {
  raceSelect: {
    groups: ["레이스 · 얼굴(정면)", "레이스 · 카드/행 판"],
    note: "카드 6장은 「동물 카드 6종」 슬롯에 **한 장으로** 올립니다 — 위 스테이지의 그 칸에 "
      + "떨어뜨리세요. 여기 얼굴(정면)은 카드 이미지를 안 올렸을 때 코드가 칸마다 채우는 그림이고, "
      + "결과 화면의 순위 6행에도 같은 파일이 쓰입니다.",
  },
  raceTrack: {
    groups: ["레이스 배경", "레이스 · 달리기(옆모습)"],
    note: "트랙 바닥은 가로로 이어 붙여 흐릅니다 — **좌우 끝이 맞물려야** 이음매가 안 보입니다. "
      + "달리기는 **오른쪽을 보는 옆모습**이고 시퀀스 여러 장을 올리면 걸음이 돕니다(한 장이면 스틸). "
      + "레인 번호 깃발과 START는 경주 배경에 그려 넣습니다 — 코드가 그리지 않습니다.",
  },
  raceResult: {
    groups: ["레이스 · 얼굴(정면)", "레이스 · 1위 축하(선택)", "레이스 · 메달", "레이스 · 카드/행 판", "부스터 아이콘"],
    note: "순위 6행 판은 「순위 6행 판」 슬롯에 **한 장으로** 올립니다 — 판과 메달까지 구워서 주세요. "
      + "얼굴(정면)은 순위 자리마다 코드가 그 등수의 동물로 채웁니다: 1위 자리에 1등이 옵니다. "
      + "1위 축하는 없으면 얼굴을 크게 씁니다(선택). 부스터 아이콘은 갱신 보상 표시에 쓰입니다.",
  },
};

function panel(note: string, items: UiUpload[], cell: number): HTMLElement {
  const wrap = $("div", "background:#241a10;border:1px solid #4a3320;border-radius:8px;padding:12px");
  wrap.appendChild($("div", "color:#a8987c;font-size:11px;margin-bottom:8px", note));
  wrap.appendChild(uploadGrid(items, cell, () => renderStage()));
  return wrap;
}

function renderExtras(): void {
  extras.replaceChildren();

  // 로비 배경 영상 — 전체화면이라 좌표는 손댈 것이 없고, 영상만 여기서 한 번에 올린다
  const scenes: UiUpload[] = area().slots
    .filter((s) => s.asset?.startsWith(SCENE_PREFIX) === true)
    .map((s) => ({ label: s.label.replace(/^로비 배경 · /, ""), asset: s.asset!, group: "로비 배경 영상" }));
  if (scenes.length > 0) {
    extras.appendChild(panel(
      "구출한 마릿수마다 한 편입니다 — 화면 전체를 덮는 webm 루프이고, 그 장면에는 그때까지 "
      + "구한 동물이 누적해 등장합니다. 9:16 · 1080×1920 · 무음 · 첫 프레임과 끝 프레임이 이어져야 "
      + "끊김 없이 돕니다. 칸 이름의 동물과 그 장면의 동물은 무관합니다 — 「3마리 구출」 칸에는 "
      + "세 마리가 있는 장면을 올립니다. 안 올린 칸은 그 이하 중 있는 것으로 내려가고, "
      + "하나도 없으면 스틸 배경이 그대로 남습니다. mp4로 올려도 webm으로 자동 변환됩니다.",
      scenes, 130));
  }

  // 자리가 코드에 고정된 에셋 — 그 화면 탭에서 바로 올린다
  const own = AREA_UPLOAD_GROUPS[area().id];
  if (own) {
    const items = state.uploads.filter((u) => u.group !== undefined && own.groups.includes(u.group));
    if (items.length > 0) extras.appendChild(panel(own.note, items, 110));
  }
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

  // 두 장을 오가는 슬롯은 카드가 둘이다. 상태 이름은 슬롯이 정할 수 있다 —
  // 토글은 켜짐/꺼짐이지만 도감은 해제/잠김이라야 읽힌다.
  const [onName, offName] = s.states ?? ["켜짐", "꺼짐"];
  if (s.asset) wrapper.appendChild(card(s.assetOff ? `${s.label} — ${onName}` : s.label, s.asset, () => renderStage()));
  if (s.assetOff) wrapper.appendChild(card(`${s.label} — ${offName}`, s.assetOff, () => renderStage()));
  if (!s.asset && !s.assetOff) wrapper.appendChild($("div", "color:#a8987c;font-size:11px", "이 슬롯은 아트 없이 코드가 그립니다."));

  detail.appendChild(wrapper);
}

/** 묶음 머리글 — 그리드 폭 전체를 가로지르는 구분선 한 줄.
 *  30장 가까운 카드를 한 그리드에 늘어놓으면 어디까지가 타일이고 어디부터가
 *  창살인지 알 수 없다. 묶음이 바뀌는 자리에만 들어간다. */
function groupHead(label: string, first: boolean): HTMLElement {
  return $("div",
    "grid-column:1/-1;font-weight:800;font-size:12px;color:#f0c96a;letter-spacing:.02em;"
    + `padding-top:${first ? 0 : 10}px;margin-top:${first ? 0 : 2}px;`
    + `border-top:${first ? "0" : "1px solid #4a3320"}`,
    label);
}

/** 카드 그리드 한 판. items의 순서가 곧 표시 순서고, group이 바뀔 때마다 구분선이 들어간다. */
function uploadGrid(items: UiUpload[], minWidth: number, onChanged?: () => void): HTMLElement {
  const grid = $("div", `display:grid;grid-template-columns:repeat(auto-fill,minmax(${minWidth}px,1fr));gap:12px;align-items:start`);
  let group: string | undefined;
  for (const u of items) {
    if (u.group && u.group !== group) {
      grid.appendChild(groupHead(u.group, group === undefined));
      group = u.group;
    }
    grid.appendChild(card(u.label, u.asset, onChanged, u.seq === true, u.hold));
  }
  return grid;
}

/** 자리가 없는 업로드 목록 — 게임 에셋 · 영상 · 오디오가 같은 모양이다.
 *  카드 폭만 다르다(그림은 좁게, 영상·오디오는 넓게). */
function renderUploads(title: string, desc: string, items: UiUpload[], minWidth: number): void {
  stageWrap.style.display = "none";
  list.replaceChildren();
  detail.replaceChildren();
  extras.replaceChildren();
  const head2 = $("div", "margin-bottom:8px");
  head2.append($("div", "font-weight:800", title), $("div", "color:#a8987c;font-size:11px", desc));
  detail.appendChild(head2);
  detail.appendChild(uploadGrid(items, minWidth));
  side.style.maxWidth = "1100px";
  side.style.flexBasis = "100%";
}

function renderAll(): void {
  renderTabs();
  paintHistButtons();
  if (state.audioTab) {
    renderUploads("오디오",
      "BGM 2종과 효과음 6종입니다. mp3·wav · 올리면 리로드 없이 게임 탭에 바로 반영됩니다. "
      + "효과음은 설정창의 SOUND, 배경음악은 MUSIC 토글을 따릅니다. 파일이 없는 슬롯은 그냥 소리가 나지 않습니다.",
      state.audios, 260);
    return;
  }
  if (state.videoTab) {
    renderUploads("영상",
      "세로 화면 전체를 덮습니다. 인트로는 게임을 열 때, 엔딩은 마지막 스테이지를 깨면 재생됩니다. "
      + "mp4·webm · 자동재생 정책 때문에 무음으로 시작하고 화면의 🔇 버튼으로 소리를 켭니다. "
      + "파일이 없으면 그 단계를 건너뜁니다.",
      state.videos, 260);
    return;
  }
  if (state.assetsTab) {
    renderUploads("게임 에셋",
      "자리가 코드에 고정된 것들입니다. 올리면 게임 탭이 바로 갱신됩니다. "
      + "🎞 표시는 여러 장을 한 번에 고르면 시퀀스가 됩니다 — 파일 이름 순으로 재생합니다.",
      state.uploads, 200);
    return;
  }
  stageWrap.style.display = "block";
  side.style.maxWidth = "560px";
  side.style.flexBasis = "380px";
  renderStage();
  renderList();
  renderDetail();
  renderExtras();
}

// ── 드래그 ──────────────────────────────────
function attachDrag(el: HTMLElement, grip: HTMLElement, s: UiSlot): void {
  let mode: "move" | "resize" | null = null;
  let startX = 0, startY = 0, ox = 0, oy = 0, ow = 0, oh = 0;

  const down = (e: PointerEvent, m: "move" | "resize"): void => {
    e.preventDefault();
    e.stopPropagation();
    if (mode === null) dragging += 1; // 끄는 동안 catchUp이 슬롯을 갈아끼우지 못하게
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
  const release = (): void => {
    if (!mode) return;
    commit(); // 드래그 한 번이 되돌리기 한 단계다
    mode = null;
    dragging = Math.max(0, dragging - 1);
    void catchUp(); // 끄는 동안 미뤄 둔 따라잡기를 지금 한다
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
}

// ── 저장 ────────────────────────────────────
/** 디스크의 배치에 이 탭이 옮긴 좌표만 얹는다.
 *
 *  이 탭은 뜰 때 읽은 배치를 기억하고 있을 뿐이라, 그 뒤에 **코드가 새로 추가한
 *  슬롯을 모른다**. 저장할 때 기억을 통째로 써 버리면 그 슬롯이 조용히 사라진다 —
 *  실제로 powerGauge와 bgPanel이 이렇게 여러 번 지워졌고, 그중 한 번은 커밋에
 *  실려 나갔다.
 *
 *  그래서 **디스크를 기준으로 삼고** 아는 슬롯의 좌표만 갈아 끼운다.
 *  에디터에는 슬롯을 지우는 기능이 없으므로, 모르는 슬롯은 남기는 것이 언제나 옳다. */
function mergeAreas(disk: UiArea[], mine: UiArea[]): UiArea[] {
  const byId = new Map(mine.map((a) => [a.id, new Map(a.slots.map((s) => [s.id, s]))]));
  return disk.map((area) => {
    const edited = byId.get(area.id);
    if (!edited) return area;
    return { ...area, slots: area.slots.map((s) => edited.get(s.id) ?? s) };
  });
}

/** 배치를 쓴다. force면 충돌을 알고도 이쪽 값으로 덮는다(사람이 눌렀을 때만).
 *
 *  **판정은 서버가 한다.** 예전엔 여기서 디스크를 읽어 견주고 나서 POST했는데,
 *  그 사이(게임 화면의 자동 저장 한 번이면 충분하다)에 들어온 쓰기는 검사를
 *  통과해 통째로 덮였다. 지금은 읽어 온 시점의 rev를 함께 보내고 서버가
 *  쓰기 직전에 본다.
 *
 *  rev 검사와 mergeAreas는 **다른 것을 막는다.** rev는 내가 아는 슬롯을 저쪽이
 *  옮겼을 때, merge는 내가 모르는 슬롯이 디스크에 생겼을 때다. 덮어쓰기(force)로
 *  갈 때도 merge는 남는다 — 알고 덮는 것은 내가 본 슬롯까지지, 못 본 슬롯이 아니다. */
async function saveLayout(force = false): Promise<void> {
  if (saving) return;
  if (!hasEditorServer()) { status.textContent = `실패: ${NO_EDITOR_SERVER}`; status.style.color = "#ff8f7a"; return; }
  saving = true;
  status.textContent = "저장 중…";
  status.style.color = "#a8987c";
  try {
    const disk = await currentLayout();
    const diskAreas = Array.isArray(disk.areas) ? (disk.areas as UiArea[]) : [];
    // 디스크를 못 읽었으면 **저장하지 않는다.**
    //
    // currentLayout()은 dev 서버 밖일 때만 {}를 주는 것이 아니라 GET이 실패하면
    // 무엇이든 {}로 삼킨다. 그런데 서버의 GET은 readFileSync를 감싸지 않아,
    // 다른 탭이 쓰는 중이면 500이 날 수 있다 — 여러 탭이 얽히는 바로 그 상황이다.
    // 그때 디스크를 빈 것으로 보고 진행하면 전체 덮어쓰기가 그대로 되살아나고,
    // disk가 {}라 uploads·videos·audios까지 통째로 날아간다. 조용히 넘기지 않는다.
    if (diskAreas.length === 0) {
      throw new Error("디스크의 배치를 읽지 못했습니다 — 저장하지 않았습니다. 새로고침 뒤 다시 시도하세요");
    }
    const merged = mergeAreas(diskAreas, state.areas);
    const res = await fetch(
      `/__uilayout?by=${encodeURIComponent(CLIENT_ID)}&rev=${encodeURIComponent(force ? "force" : state.rev)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...disk, areas: merged }),
      },
    );
    if (res.status === 409) {
      showConflict("다른 창에서 배치가 바뀌어 저장하지 않았습니다. 새로 읽거나, 알고도 이쪽 값으로 덮어쓰세요.");
      status.textContent = "저장 안 함 — 디스크가 더 새롭습니다";
      status.style.color = "#f0c96a";
      return;
    }
    if (!res.ok) throw new Error(await res.text());
    state.dirty = false;
    // 기준점은 내가 들고 있는 것이 아니라 **실제로 쓴 것**이다 —
    // merge가 얹은 「내가 모르는 슬롯」까지 디스크에 있다
    state.baseline = cloneAreas(merged);
    state.rev = res.headers.get("x-layout-rev") ?? state.rev;
    hideConflict();
    status.textContent = "저장됨";
    status.style.color = "#8fdc8f";
  } catch (err) {
    status.textContent = `실패: ${String(err)}`;
    status.style.color = "#ff8f7a";
  } finally {
    saving = false;
  }
}

saveBtn.onclick = (): void => { void saveLayout(); };

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
      const fresh = (await l.json()) as {
        uploads?: UiUpload[]; videos?: UiUpload[]; audios?: UiUpload[];
      };
      const areas = parseAreas(fresh);
      if (areas.length > 0) adoptAreas(areas, l.headers.get("x-layout-rev") ?? "");
      if (Array.isArray(fresh.uploads)) state.uploads = fresh.uploads;
      if (Array.isArray(fresh.videos)) state.videos = fresh.videos;
      if (Array.isArray(fresh.audios)) state.audios = fresh.audios;
    }
    if (a.ok) state.manifest = (await a.json()) as Record<string, unknown>;
  } catch { /* dev 서버 밖 — 번들 값 그대로 */ }
}

// ── 게임 화면의 편집을 따라잡기 ───────────────
// 이 탭은 부팅 때 한 번 읽고 끝이었다. 게임 화면(?editor=1)에서 고친 배치가
// 여기 보이지 않았고, 저장을 누르면 낡은 메모리 값이 그 편집을 덮어썼다.
//
// 알림(ws)과 탭 포커스 **둘 다**에서 따라잡는다. 알림 하나만 두면 서버가
// 다시 뜬 뒤 이 탭의 ws가 끊긴 채로 남았을 때 영영 낡은 값을 들게 된다.

/** 디스크에서 온 배치를 받아들이고 기준점·히스토리를 새로 잡는다. */
function adoptAreas(areas: UiArea[], rev: string): void {
  state.areas = areas;
  state.baseline = cloneAreas(areas);
  state.rev = rev;
  // 영역이 줄어든 파일을 읽으면 보고 있던 탭이 사라진다 — 없는 칸을 가리키면
  // area()의 ! 단언이 undefined를 통과시켜 그리는 쪽에서 터진다
  if (state.areaIndex >= state.areas.length) state.areaIndex = 0;
  // 고르고 있던 슬롯이 아직 있으면 그대로 둔다 — 저쪽 창이 자동 저장할 때마다
  // 선택이 풀리면 여기서 숫자를 맞추던 사람의 자리가 계속 사라진다
  const keep = state.areas[state.areaIndex]?.slots.some((sl) => sl.id === state.selected) === true;
  if (!keep) state.selected = null;
  // 새로 만들지 않고 시작점만 옮긴다 — 히스토리 객체를 갈면 되돌리기가 통째로 날아간다
  if (history) history.reset(state.areas);
  else history = createHistory<UiArea[]>(state.areas);
}

interface DiskLayout { areas: UiArea[]; rev: string }

/** 디스크의 배치를 읽는다. 반드시 파서를 지난다 — 손으로 고친 파일이
 *  슬롯을 빠뜨려도 화면이 아니라 여기서 흡수한다. dev 서버 밖이면 null. */
async function fetchLayout(): Promise<DiskLayout | null> {
  try {
    const r = await fetch("/__uilayout");
    if (!r.ok) return null;
    const raw: unknown = await r.json();
    const areas = parseAreas(raw);
    if (areas.length === 0) return null;
    return { areas, rev: r.headers.get("x-layout-rev") ?? "" };
  } catch { return null; }
}

function showConflict(text: string): void {
  conflictText.textContent = text;
  conflict.style.display = "block";
}

const hideConflict = (): void => { conflict.style.display = "none"; };

function announce(text: string): void {
  status.textContent = text;
  status.style.color = "#8fdc8f";
}

/** 디스크가 내가 읽어 온 뒤로 바뀌었나 확인하고 따라잡는다.
 *  저장 안 된 변경이 여기 있으면 **말없이 버리지 않는다** — 사람이 고르게 둔다. */
async function catchUp(): Promise<void> {
  if (dragging > 0) return; // 끌고 있는 중이면 건드리지 않는다 — pointerup이 다시 부른다
  const seq = ++pullSeq;
  const disk = await fetchLayout();
  if (!disk) return;
  if (seq !== pullSeq) return; // 나보다 늦게 떠난 요청이 이미 왔다 — 내 값은 헌 값이다
  if (dragging > 0) return;    // 기다리는 사이에 끌기 시작했다
  if (sameAreas(disk.areas, state.baseline)) {
    state.rev = disk.rev; // 뜻은 그대로여도 파일은 다시 쓰였다 — 리비전만 따라간다
    hideConflict();
    return;
  }
  if (state.dirty) {
    showConflict("다른 창에서 배치가 바뀌었습니다. 새로 읽으면 여기서 저장하지 않은 변경은 사라지고, 덮어쓰면 저 변경이 사라집니다.");
    return;
  }
  adoptAreas(disk.areas, disk.rev);
  hideConflict();
  renderAll();
  announce("다른 창의 배치를 읽었습니다");
}

reloadBtn.onclick = (): void => {
  const seq = ++pullSeq; // catchUp과 같은 규칙으로 줄을 선다 — await 뒤에 잡으면
  void fetchLayout().then((disk) => { //  나보다 늦게 떠난 응답에 밀린다
    if (!disk || seq !== pullSeq) return;
    adoptAreas(disk.areas, disk.rev);
    state.dirty = false;
    hideConflict();
    renderAll();
    announce("다른 창의 배치를 읽었습니다");
  });
};

/** 충돌을 알고도 이쪽 값을 쓰겠다는 선택. 버튼이 없으면 여기서 한 작업을
 *  살릴 길이 배너를 무시하는 것밖에 없다 — 그건 선택이 아니라 막다른 길이다. */
overwriteBtn.onclick = (): void => { void saveLayout(true); };

if (import.meta.hot) {
  import.meta.hot.on("layout-updated", (d: { by?: string }) => {
    if (d?.by === CLIENT_ID) return; // 방금 내가 쓴 것 — 다시 읽을 이유가 없다
    void catchUp();
  });
}
// 탭을 다시 보는 순간이 게임 화면에서 돌아오는 순간이다. focus도 함께 듣는다 —
// 두 창을 나란히 띄워 두면 탭이 숨지 않아 visibilitychange가 오지 않는다.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void catchUp();
});
window.addEventListener("focus", () => { void catchUp(); });
// 창을 벗어난 채 손을 떼면 pointerup이 이 페이지로 오지 않는다 — 걸쇠를 여기서 푼다.
// 끌던 값은 화면에 이미 반영돼 있고 저장 안 됨 표시도 서 있으므로 잃는 것이 없다.
window.addEventListener("blur", () => { dragging = 0; });

void syncFromDisk().then(() => {
  // dev 서버 밖이면 adoptAreas가 안 불렸다 — 번들 값 그대로가 시작점이다
  history ??= createHistory<UiArea[]>(state.areas);
  renderAll();
  status.textContent = "";
});
