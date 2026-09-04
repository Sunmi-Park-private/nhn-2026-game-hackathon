// ui/worldScreen.ts — 월드 지도. 로비 하단 WORLD로 들어온다.
//
// 배경 아트 한 장이 화면 전체를 그린다. **누를 수 있는 것은 둘뿐이다** —
// 우상단 설정(톱니)과 좌하단 돌아가기. 스테이지 노드·표지판·동물은 전부 그림이다.
import type { Container, Texture } from "pixi.js";
import { openArtPage } from "./artPage";
import { openSettings, type SettingsTextures } from "./settingsMenu";

export interface WorldTextures {
  bg?: Texture;
  back?: Texture;
  gear?: Texture;
  ui: SettingsTextures;
}

/** 월드가 닫히면서 호출자에게 넘기는 결정. lobby는 설정창의 HOME으로 나간 경우다. */
export type WorldResult = "back" | "lobby";

/** 월드 지도를 띄우고 닫힐 때까지 기다린다. */
export function openWorld(parent: Container, tex: WorldTextures): Promise<WorldResult> {
  return openArtPage<WorldResult>(parent, {
    area: "world",
    bg: tex.bg,
    buttons: (close, root) => [
      {
        id: "back",
        label: "돌아가기",
        fallback: { x: 17, y: 740, w: 126, h: 35 },
        fill: 0x6b4626,
        tex: tex.back,
        onTap: () => close("back"),
      },
      {
        // 설정은 로비·인게임과 같은 자리다 — 화면이 바뀌어도 톱니가 움직이지 않아야 한다
        id: "gear",
        label: "설정",
        fallback: { x: 400, y: 10, w: 40, h: 40 },
        fill: 0x4a3320,
        tex: tex.gear,
        onTap: () => {
          void openSettings(root, tex.ui).then((r) => { if (r === "lobby") close("lobby"); });
        },
      },
    ],
  });
}
