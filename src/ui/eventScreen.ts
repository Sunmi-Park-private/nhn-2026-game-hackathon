// ui/eventScreen.ts — 이벤트(한정 구조). 로비 하단 EVENTS로 들어온다.
//
// 배경 아트 한 장이 화면 전체를 그린다. **누를 수 있는 것은 둘뿐이다** —
// 우상단 닫기와 아래쪽 「스테이지 N으로」. 사자·보상·문구는 전부 그림이다.
import type { Container, Texture } from "pixi.js";
import { openArtPage } from "./artPage";

export interface EventTextures {
  bg?: Texture;
  close?: Texture;
  cta?: Texture;
}

/** 이벤트가 닫히면서 호출자에게 넘기는 결정.
 *  stage는 「스테이지 N으로」를 누른 경우 — 아직 스테이지가 하나뿐이라 로비로 되돌린다. */
export type EventResult = "close" | "stage";

/** 이벤트 화면을 띄우고 닫힐 때까지 기다린다. */
export function openEvent(parent: Container, tex: EventTextures): Promise<EventResult> {
  return openArtPage<EventResult>(parent, {
    area: "event",
    bg: tex.bg,
    buttons: (close) => [
      {
        id: "close",
        label: "닫기",
        fallback: { x: 386, y: 124, w: 46, h: 45 },
        fill: 0xd23b30,
        tex: tex.close,
        onTap: () => close("close"),
      },
      {
        id: "cta",
        label: "스테이지로",
        fallback: { x: 88, y: 614, w: 275, h: 63 },
        fill: 0x3faa48,
        tex: tex.cta,
        onTap: () => close("stage"),
      },
    ],
  });
}
