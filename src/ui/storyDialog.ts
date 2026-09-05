// ui/storyDialog.ts — 스테이지 사이에 끼는 대사창. 판을 깬 직후 한 번 뜬다.
//
// 대사도 초상도 **주입받는다**(규약 2조) — 이 파일은 ../data를 모른다. 붉은말과 동물이
// 누구인지도 모르고, 「왼쪽에 말하는 쪽 하나, 오른쪽에 하나」만 안다.
//
// 상태는 전부 아래 `st` 하나에 담는다(규약 4조). 화면이 내려갈 때 rAF와 리스너를
// 명시적으로 끊는다 — 부모가 붙어 있는지로 살아 있는지를 추측하지 않는다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fullRect, contentRect } from "./stage";
import { fitSprite } from "./skin";
import { plate, hotspot } from "./panelBits";
import { playSfx } from "./audio";
import { STORY_LAYOUT, DIM_ALPHA, SPEAKING_SCALE, type Box } from "./storyLayout";

/** 한 줄. who는 좌우 초상 중 어느 쪽이 말하는지다. */
export interface DialogLine {
  who: "horse" | "animal";
  text: string;
}

export interface StoryDialogOptions {
  lines: readonly DialogLine[];
  /** 왼쪽 초상 — 붉은말. 없으면 이름표만 나온다 */
  horseTex?: Texture;
  /** 오른쪽 초상 — 방금 구한 동물 */
  animalTex?: Texture;
  /** 이름표에 쓸 글자 */
  horseName: string;
  animalName: string;
  /** 한 글자당 밀리초. 0이면 타자 효과 없이 한 번에 나온다 */
  charMs?: number;
}

const CHAR_MS = 28;

/** 초상 하나. 아트가 없으면 자리만 잡고 빈 컨테이너를 돌려준다. */
function portrait(b: Box, tex: Texture | undefined): Container {
  const c = new Container();
  c.x = b.x + b.w / 2;
  c.y = b.y + b.h / 2;
  if (tex) c.addChild(fitSprite(tex, b.w, b.h));
  return c;
}

/**
 * 대사를 끝까지 보여 주고 닫힌다. 화면 아무 데나 누르면 다음 줄로 가고,
 * 타자 중에 누르면 그 줄을 한 번에 채운다. 우상단 건너뛰기로 즉시 빠져나온다.
 *
 * 줄이 하나도 없으면 아무것도 띄우지 않는다 — 호출부가 조건을 따지지 않아도 된다.
 */
export function openStoryDialog(parent: Container, opts: StoryDialogOptions): Promise<void> {
  if (opts.lines.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const L = STORY_LAYOUT;
    const charMs = opts.charMs ?? CHAR_MS;

    const root = new Container();
    parent.addChild(root);

    // 막 — 좌우 블리드는 반투명으로 어둡게 덮어 barn 아트가 비치게 두고,
    // **콘텐츠 컬럼은 불투명하게 칠한다.** 반투명으로 뒀더니 파란 띠가 비쳤다 —
    // main.ts가 모든 화면 밑에 깔아 둔 로비 배경 아트(assets/lobby/bg.webp)의
    // 가운데 450 컬럼이 순수 파랑(#0617fa)이다. 어차피 모든 화면이 제 배경으로
    // 덮는 자리라 디자이너가 채워 둔 것이고, 다른 화면들도 전부 contentRect로 덮는다.
    const veil = fullRect(0x0d0906, 0.62);
    veil.eventMode = "static";
    root.addChild(veil);
    root.addChild(contentRect(0x1c1209));

    const horse = portrait(L.horse, opts.horseTex);
    const animal = portrait(L.animal, opts.animalTex);
    root.addChild(horse, animal);

    // ── 대사창 ────────────────────────────────
    const g = new Graphics();
    g.roundRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 16).fill({ color: 0x2a1b0e, alpha: 0.94 });
    g.roundRect(L.panel.x + 5, L.panel.y + 5, L.panel.w - 10, L.panel.h - 10, 12)
      .stroke({ width: 3, color: 0x8a5a2b });
    root.addChild(g);

    const name = new Text({ text: "", style: { fontSize: 19, fill: 0xffd35c, fontWeight: "bold" } });
    name.x = L.name.x;
    name.y = L.name.y;
    root.addChild(name);

    const body = new Text({
      text: "",
      style: { fontSize: 19, fill: 0xfff3dc, lineHeight: 30, wordWrap: true, wordWrapWidth: L.text.w },
    });
    body.x = L.text.x;
    body.y = L.text.y;
    root.addChild(body);

    const hint = new Text({
      text: "탭하여 계속 ▶",
      style: { fontSize: 13, fill: 0xc9a271 },
    });
    hint.anchor.set(1, 0.5);
    hint.x = L.hint.x + L.hint.w;
    hint.y = L.hint.y + L.hint.h / 2;
    hint.visible = false;
    root.addChild(hint);

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
      const speaking = line.who === "horse" ? horse : animal;
      const quiet = line.who === "horse" ? animal : horse;
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

    // 건너뛰기 — 대사를 다 읽은 사람이 매번 다섯 번 탭하지 않게 한다
    const skip = new Container();
    skip.addChild(plate(L.skip, undefined, 0x4a3320, "건너뛰기"));
    skip.addChild(hotspot(null, L.skip, finish));
    root.addChild(skip);

    paintLine();
  });
}
