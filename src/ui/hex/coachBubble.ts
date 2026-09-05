// ui/hex/coachBubble.ts — 붉은말이 하는 말을 그리는 말풍선. 첫 판의 코칭 전용이다.
//
// 언제 무엇을 말하는지는 engine/tutorialCoach가 정한다. 여기는 **그리는 일만** 한다.
// 좌표는 전부 주입받는다(규약 2조) — 이 파일은 uiLayout도 스테이지 정의도 모른다.
// 화면 상태는 팩토리 클로저의 값에 담고, 내려갈 때 rAF까지 명시적으로 끈다(규약 4조).
//
// 말풍선이 떠 있는 동안은 판을 막는다. 막이 맨 위에 깔려 톱니와 발사 입력을 함께 먹는다 —
// 설명을 읽는 중에 잘못 당겨 한 발을 날리면 그 단계를 두 번 설명하게 된다.
import { Container, Graphics, Text } from "pixi.js";
import type { CoachStep } from "../../engine/tutorialCoach";

export interface Point { x: number; y: number }

export interface CoachTargets {
  /** 당길 수 있는 범위를 알려주는 테두리의 윗변 가운데 */
  pull: Point;
  /** 붉은말이 서 있는 자리(윗변 중앙) */
  horse: Point;
  /** 케이지 중앙. 없는 판이면 null — 꼬리 없이 말풍선만 뜬다 */
  cage: Point | null;
}

export interface CoachBubble {
  root: Container;
  /** 띄울 단계. null이면 막까지 내린다 */
  sync(step: CoachStep | null): void;
  destroy(): void;
}

const CREAM = 0xfff3d9;
const BROWN = 0x6b4a24;
const INK = 0x3d2a12;

/** 말풍선 상자 크기. 두 줄 대사에 맞춰 고정한다 — 대사마다 폭이 달라지면 시선이 튄다. */
const BOX_W = 260;
const BOX_H = 96;
/** 말풍선과 가리키는 대상 사이 간격. 꼬리가 이 틈을 건넌다. */
const GAP = 54;
/** 화면 위쪽에서 비워 두는 띠. 스테이지 바가 여기 산다 — 상자가 이 위로 올라가면\n *  대신 대상 아래에 세운다. */
const TOP_KEEPOUT = 84;

export function createCoachBubble(opts: {
  targets: CoachTargets;
  /** 막을 영역. 스테이지 화면의 좌표계로 받는다 */
  screen: { x: number; y: number; w: number; h: number };
  /** 막을 탭했다 — 다음으로 넘어간다 */
  onTap: () => void;
}): CoachBubble {
  const { targets, screen, onTap } = opts;

  const root = new Container();
  root.visible = false;

  // 막 — 판을 살짝만 덮는다. 짙게 덮으면 2단계가 말하는 「같은 색 3개」가 안 보인다.
  const veil = new Graphics()
    .rect(screen.x, screen.y, screen.w, screen.h)
    .fill({ color: 0x1a0f04, alpha: 0.28 });
  veil.eventMode = "static";
  veil.cursor = "pointer";
  veil.on("pointertap", () => onTap());

  // 말풍선 한 덩어리. 이것만 위아래로 흔든다 — 막까지 흔들면 딤의 가장자리가 드러난다.
  const card = new Container();
  const balloon = new Graphics();

  const line = new Text({
    text: "",
    style: { fontFamily: "sans-serif", fontSize: 21, fill: INK, align: "center", lineHeight: 27 },
  });
  line.anchor.set(0.5);

  const tapHint = new Text({
    text: "탭하면 계속",
    style: { fontFamily: "sans-serif", fontSize: 13, fill: 0x8a6a3c },
  });
  tapHint.anchor.set(0.5);

  card.addChild(balloon, line, tapHint);
  root.addChild(veil, card);

  /** 말풍선 상자와 꼬리를 그린다. 꼬리는 대상이 있는 쪽 변에서 대상을 향해 뻗는다.
   *  아래로만 뻗게 두면 판 위쪽의 케이지를 가리킬 때 상자가 스테이지 바를 덮는다. */
  function drawBalloon(box: { x: number; y: number }, tailTo: Point | null): void {
    balloon.clear();
    balloon.roundRect(box.x, box.y, BOX_W, BOX_H, 18).fill(CREAM).stroke({ width: 3, color: BROWN });
    if (!tailTo) return;
    // 꼬리 뿌리는 대상의 x를 따라간다 — 상자 밖으로 나가지 않게 안쪽으로 물린다
    const rootX = Math.min(Math.max(tailTo.x, box.x + 34), box.x + BOX_W - 34);
    const up = tailTo.y < box.y; // 대상이 상자보다 위에 있다
    const baseY = up ? box.y : box.y + BOX_H;
    const dir = up ? -1 : 1;
    const tipY = up
      ? Math.max(tailTo.y, baseY - GAP * 0.7)
      : Math.min(tailTo.y, baseY + GAP * 0.7);
    balloon
      .poly([rootX - 14, baseY - 2 * dir, rootX + 14, baseY - 2 * dir, rootX + 2, tipY])
      .fill(CREAM)
      .stroke({ width: 3, color: BROWN });
    // 뿌리 쪽 테두리를 덮어 상자와 꼬리가 한 덩어리로 읽히게 한다
    balloon.rect(rootX - 12, baseY - (up ? 1 : 4), 24, 5).fill(CREAM);
  }

  let target: Point | null = null;
  let frame = 0;
  let startedAt = 0;

  // 말풍선이 천천히 숨쉬듯 오르내린다. 화살표를 따로 그리지 않는 이유가 이것이다 —
  // 꼬리가 이미 대상을 가리키는데 그 위에 화살표까지 겹치면 둘 다 안 읽힌다.
  function tick(): void {
    const t = (performance.now() - startedAt) / 1000;
    card.y = Math.sin(t * 2.4) * 4;
    frame = requestAnimationFrame(tick);
  }

  function stopTick(): void {
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    card.y = 0;
  }

  return {
    root,

    sync(step: CoachStep | null): void {
      if (!step) {
        stopTick();
        root.visible = false;
        return;
      }

      target =
        step.point === "pull" ? targets.pull
        : step.point === "horse" ? targets.horse
        : step.point === "cage" ? targets.cage
        : null;

      // 상자는 대상 위에 얹는다. 가리킬 것이 없으면 화면 가운데 위쪽에 세운다.
      const anchor = target ?? { x: screen.x + screen.w / 2, y: screen.y + screen.h * 0.52 };
      const x = Math.min(
        Math.max(anchor.x - BOX_W / 2, screen.x + 12),
        screen.x + screen.w - BOX_W - 12,
      );
      // 기본은 대상 위다. 다만 대상이 화면 위쪽(케이지)이라 상자가 스테이지 바까지
      // 밀려 올라가야 한다면 대상 **아래**에 세운다 — 판의 정보를 덮지 않는 쪽이 낫다.
      const above = anchor.y - GAP - BOX_H;
      const y = above >= screen.y + TOP_KEEPOUT ? above : anchor.y + GAP;
      drawBalloon({ x, y }, target);
      line.text = step.text;
      line.x = x + BOX_W / 2;
      line.y = y + BOX_H / 2 - 8;
      tapHint.x = x + BOX_W / 2;
      tapHint.y = y + BOX_H - 16;

      root.visible = true;
      if (frame === 0) {
        startedAt = performance.now();
        tick();
      }
    },

    destroy(): void {
      stopTick();
      veil.off("pointertap");
      root.destroy({ children: true });
    },
  };
}
