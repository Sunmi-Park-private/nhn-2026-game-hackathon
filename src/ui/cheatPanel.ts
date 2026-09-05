// ui/cheatPanel.ts — 개발용 치트 패널. `?editor=1`에서 화면 **왼쪽**에 붙는다.
//
// 왜 있나: 로비가 보여주는 것(배경 영상·도감)은 전부 「무엇을 구출했나」에서 나온다.
// 그걸 확인하려면 원래는 스테이지를 실제로 깨야 해서, 배경 영상 여섯 편을 눈으로
// 맞춰 보려면 판을 여섯 번 깨야 했다. 여기서 바로 세운다.
//
// 배치 에디터 패널은 오른쪽에 있으므로(ui/layoutEditor.ts) 이쪽은 왼쪽을 쓴다.
//
// 규약 6조 — 치트는 devMode 게이트 뒤에만 산다. 제출 빌드에서는 뜨지 않는다.
import { isDevMode } from "./devMode";
import { ANIMALS } from "../data/animals";
import { sceneCandidates, SCENE_KEYS } from "../data/lobbyScene";
import { parseProfile, serializeProfile, PROFILE_KEY, type Profile } from "../engine/profile";

const CSS = {
  panel: "position:fixed;left:12px;top:12px;width:212px;max-height:86vh;overflow-y:auto;z-index:1300;"
    + "background:#241a10;border:1px solid #4a3320;border-radius:10px;padding:10px 12px;"
    + "font:12px/1.5 system-ui,-apple-system,sans-serif;color:#e8dcc8;box-shadow:0 8px 24px #0008",
  head: "display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:2px",
  title: "font-weight:800;font-size:13px",
  fold: "background:#2b1d10;color:#e8dcc8;border:1px solid #4a3320;border-radius:6px;"
    + "padding:2px 8px;cursor:pointer;font-size:11px;font-weight:700",
  note: "color:#a8987c;font-size:11px;margin-bottom:8px",
  row: "display:flex;flex-direction:column;gap:4px",
  state: "margin-top:8px;padding-top:8px;border-top:1px solid #4a3320;color:#a8987c;font-size:11px",
} as const;

function el(tag: string, css: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.style.cssText = css;
  if (text) node.textContent = text;
  return node;
}

/** 고른 것이 한눈에 보여야 한다 — 색만으로도 구분되게 글머리도 함께 바꾼다.
 *  **하나만 고른다**: 로비 배경은 「몇 마리 구했나」 하나로 정해지므로
 *  여러 개를 켜는 것은 뜻이 없다. */
function paintRadio(b: HTMLElement, on: boolean, label: string): void {
  b.textContent = `${on ? "◉" : "○"} ${label}`;
  b.style.cssText = "text-align:left;border:1px solid #4a3320;border-radius:6px;padding:6px 9px;"
    + "cursor:pointer;font-size:12px;font-weight:700;"
    + (on ? "background:#3faa48;color:#0f1a0f" : "background:#2b1d10;color:#a8987c");
}

/**
 * 치트 패널을 띄운다. dev 모드가 아니거나 `?editor=1`이 아니면 아무 일도 하지 않는다.
 *
 * 값을 바꾸면 **저장하고 새로고침한다.** 게임 루프는 프로필을 뜰 때 한 번 읽어 지역
 * 변수로 들고 있어서, 저장만 해서는 돌고 있는 로비가 모른다. `?editor=1`은 인트로를
 * 건너뛰므로 새로고침이 곧 로비다 — 눌렀을 때 화면이 바로 바뀌는 것이 중요하다.
 */
export function mountCheatPanel(): void {
  if (!isDevMode()) return;
  if (!new URLSearchParams(location.search).has("editor")) return;

  const read = (): Profile => parseProfile(localStorage.getItem(PROFILE_KEY));

  /** 저장하고 새로 뜬다. 저장이 막혀 있어도(프라이빗 모드) 게임은 굴러가야 한다. */
  const apply = (next: Profile): void => {
    try { localStorage.setItem(PROFILE_KEY, serializeProfile(next)); } catch { /* 무시 */ }
    location.reload();
  };

  const panel = el("div", CSS.panel);

  const head = el("div", CSS.head);
  head.append(el("div", CSS.title, "🧪 치트"));
  const fold = el("button", CSS.fold, "숨기기");
  head.append(fold);
  panel.append(head);

  const body = el("div", "");
  body.append(el("div", CSS.note,
    "구출 단계를 고른다. 판을 깨지 않고 로비를 확인할 때 쓴다. "
    + "영상 한 편에 그 단계까지의 동물이 다 들어 있어서 단계는 하나만 고른다."));

  const rows = el("div", CSS.row);
  body.append(rows);

  const state = el("div", CSS.state);
  body.append(state);
  panel.append(body);

  function render(): void {
    const p = read();

    const n = p.rescued.length;

    rows.replaceChildren();
    // 0마리부터 6마리까지. 고른 단계 = 앞에서부터 그만큼 구출한 상태다 —
    // 장면 번호가 곧 마릿수이므로 순서도 animals.ts 순서를 그대로 따른다.
    for (let step = 0; step <= ANIMALS.length; step += 1) {
      const b = el("button", "");
      const faces = ANIMALS.slice(0, step).map((a) => a.glyph).join("");
      paintRadio(b, step === n, step === 0 ? "0마리 · 말 혼자" : `${step}마리 · ${faces}`);
      b.onclick = (): void => {
        if (step === n) return; // 같은 단계를 다시 눌러 새로고침만 하지 않는다
        apply({ ...p, rescued: ANIMALS.slice(0, step).map((a) => a.id) });
      };
      rows.append(b);
    }

    // 무엇이 나올지 미리 말해 준다 — 골라 놓고 「왜 그대로지」 하는 일이 없게.
    // 파일이 실제로 있는지는 여기서 알 수 없다(받아 봐야 안다). 그래서 후보를 적는다.
    const first = sceneCandidates(n)[0];
    state.textContent = `구출 ${n}마리 — 배경 영상 ${SCENE_NO[first ?? ""] ?? "?"}번부터 아래로 찾는다`;
  }

  /** 장면 키 → 사람이 읽는 번호(=마릿수). 키 이름의 동물과 그 장면의 동물은 무관하다. */
  const SCENE_NO: Record<string, number> = {};
  SCENE_KEYS.forEach((k, i) => { SCENE_NO[k] = i; });

  fold.onclick = (): void => {
    const hidden = body.style.display === "none";
    body.style.display = hidden ? "" : "none";
    fold.textContent = hidden ? "숨기기" : "펼치기";
  };

  render();
  document.body.appendChild(panel);
}
