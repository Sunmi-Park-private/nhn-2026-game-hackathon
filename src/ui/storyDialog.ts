// ui/storyDialog.ts — 스테이지 사이에 끼는 대사창. 판을 깬 직후 한 번 뜬다.
//
// 대사도 초상도 좌표도 **주입받는다**(규약 2조) — 이 파일은 ../data를 모른다. 붉은말과
// 동물이 누구인지도 모르고, 「왼쪽에 말하는 쪽 하나, 오른쪽에 하나」만 안다.
//
// 그림은 storyView.ts가 만든다. 여기 남은 것은 **흐름**뿐이다 — 어느 줄인지, 타자가
// 어디까지 찍었는지, 언제 닫는지.
//
// 상태는 전부 아래 `st` 하나에 담는다(규약 4조). 화면이 내려갈 때 rAF와 에디터 등록을
// 명시적으로 끊는다 — 부모가 붙어 있는지로 살아 있는지를 추측하지 않는다.
import { Container, type Texture } from "pixi.js";
import { plate, hotspot } from "./panelBits";
import { playSfx } from "./audio";
import { clearEditable } from "./layoutEditor";
import { STORY_AREA, STORY_SKIP, DIM_ALPHA, SPEAKING_SCALE, type StorySlotId } from "./storyLayout";
import { buildStoryView, type StorySlot } from "./storyView";

/** 한 줄. who는 좌우 초상 중 어느 쪽이 말하는지다. */
export interface DialogLine {
  who: "horse" | "animal";
  text: string;
}

export interface StoryDialogOptions {
  lines: readonly DialogLine[];
  /** 왼쪽 초상 — 붉은말. 없으면 자리만 빈다 */
  horseTex?: Texture;
  /** 오른쪽 초상 — 방금 구한 동물 */
  animalTex?: Texture;
  /** 이름표에 쓸 글자 */
  horseName: string;
  animalName: string;
  /** uiLayout의 story 영역 슬롯. 없으면 storyLayout.ts의 폴백으로 간다 */
  slot?: (id: StorySlotId) => StorySlot | null;
  /** 한 글자당 밀리초. 0이면 타자 효과 없이 한 번에 나온다 */
  charMs?: number;
}

const CHAR_MS = 28;

/**
 * 대사를 끝까지 보여 주고 닫힌다. 화면 아무 데나 누르면 다음 줄로 가고,
 * 타자 중에 누르면 그 줄을 한 번에 채운다. 우상단 건너뛰기로 즉시 빠져나온다.
 *
 * 줄이 하나도 없으면 아무것도 띄우지 않는다 — 호출부가 조건을 따지지 않아도 된다.
 */
export function openStoryDialog(parent: Container, opts: StoryDialogOptions): Promise<void> {
  if (opts.lines.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const charMs = opts.charMs ?? CHAR_MS;
    const view = buildStoryView(parent, {
      slot: opts.slot,
      horseTex: opts.horseTex,
      animalTex: opts.animalTex,
    });
    const { root, veil, name, body, hint } = view;

    // ── 상태는 여기 하나 ──────────────────────
    const st = { i: 0, shown: 0, raf: 0, done: false, startedAt: 0 };

    const stopRaf = (): void => {
      if (st.raf !== 0) cancelAnimationFrame(st.raf);
      st.raf = 0;
    };

    const finish = (): void => {
      if (st.done) return;
      st.done = true;
      stopRaf();
      clearEditable(STORY_AREA); // 파괴된 노드를 에디터가 붙잡고 있으면 다음 드래그에서 죽는다
      if (!root.destroyed) root.destroy({ children: true });
      resolve();
    };

    /** 현재 줄을 통째로 드러내고 힌트를 켠다. */
    const revealAll = (): void => {
      const line = opts.lines[st.i];
      if (!line) return;
      stopRaf();
      st.shown = [...line.text].length;
      body.text = line.text;
      hint.visible = true;
    };

    const paintLine = (): void => {
      const line = opts.lines[st.i];
      if (!line) { finish(); return; }
      const speaking = line.who === "horse" ? view.horse : view.animal;
      const quiet = line.who === "horse" ? view.animal : view.horse;
      name.text = line.who === "horse" ? opts.horseName : opts.animalName;
      speaking.alpha = 1;
      speaking.scale.set(SPEAKING_SCALE);
      quiet.alpha = DIM_ALPHA;
      quiet.scale.set(1);
      body.text = "";
      hint.visible = false;
      st.shown = 0;

      if (charMs <= 0) { revealAll(); return; }
      const chars = [...line.text];
      st.startedAt = performance.now();
      const tick = (): void => {
        st.raf = 0;
        if (body.destroyed) return;
        const n = Math.floor((performance.now() - st.startedAt) / charMs);
        if (n >= chars.length) { revealAll(); return; }
        if (n !== st.shown) {
          st.shown = n;
          body.text = chars.slice(0, n).join("");
        }
        st.raf = requestAnimationFrame(tick);
      };
      tick();
    };

    /** 탭 한 번 — 타자 중이면 마저 채우고, 다 나왔으면 다음 줄. 마지막이면 닫는다. */
    const advance = (): void => {
      if (st.done) return;
      playSfx("audio.sfxTap");
      const line = opts.lines[st.i];
      if (line && st.shown < [...line.text].length) { revealAll(); return; }
      st.i += 1;
      if (st.i >= opts.lines.length) { finish(); return; }
      paintLine();
    };

    veil.on("pointertap", advance);

    // 건너뛰기 — 대사를 다 읽은 사람이 매번 다섯 번 탭하지 않게 한다.
    // 자리는 코드가 정한다(영상 건너뛰기와 같은 자리) — 에디터에 열지 않는다.
    const skip = new Container();
    skip.addChild(plate(STORY_SKIP, undefined, 0x4a3320, "건너뛰기"));
    skip.addChild(hotspot(null, { ...STORY_SKIP, id: "skip" }, finish));
    root.addChild(skip);

    paintLine();
    // 글자가 들어간 뒤에 등록한다 — 빈 Text는 크기가 0이라 에디터가 잡지 못한다
    view.register();
  });
}
