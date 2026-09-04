// ui/hex/boardView.ts — 셀 맵을 화면에 반영한다.
// 상태를 갖지 않고 sync(cells)로 현재 맵과 화면을 맞춘다 — 델타 추적을 하지 않는다.
import { Container, type Texture } from "pixi.js";
import { key, parseKey } from "../../engine/hex/coords";
import type { Axial, Cell } from "../../engine/hex/types";
import { cellToScreen } from "./geom";
import { makeTileView, makeHorseshoeView } from "./tileArt";

export interface TileTextures {
  /** 티어 0~5의 텍스처. 미업로드 칸은 null → 색 육각 폴백 */
  tiles: Array<Texture | null>;
  horseshoe: Texture | null;
}

export interface BoardView {
  root: Container;
  /** 셀 맵과 화면을 맞춘다. 사라진 것은 지우고 새로 생긴 것은 만든다. */
  sync(cells: Map<string, Cell>): void;
  viewAt(a: Axial): Container | undefined;
  destroy(): void;
}

/** 셀 내용의 정체성. 이 값이 바뀌면 표시 객체를 새로 만든다. */
function signature(cell: Cell): string {
  switch (cell.kind) {
    case "tile": return `t${cell.tier}`;
    case "horseshoe": return "h";
    case "cage": return `c${cell.cageId}`;
  }
}

export function createBoardView(textures: TileTextures): BoardView {
  const root = new Container();
  const views = new Map<string, { view: Container; sig: string }>();

  function makeView(cell: Cell): Container | null {
    switch (cell.kind) {
      case "tile": return makeTileView(cell.tier, textures.tiles[cell.tier] ?? null);
      case "horseshoe": return makeHorseshoeView(textures.horseshoe);
      case "cage": return null; // 케이지는 cageView가 따로 그린다
    }
  }

  return {
    root,

    sync(cells: Map<string, Cell>): void {
      // 사라졌거나 내용이 바뀐 것을 걷어낸다
      for (const [k, entry] of [...views]) {
        const cell = cells.get(k);
        if (!cell || signature(cell) !== entry.sig) {
          entry.view.destroy();
          views.delete(k);
        }
      }
      // 새로 생긴 것을 만든다
      for (const [k, cell] of cells) {
        if (views.has(k)) continue;
        const view = makeView(cell);
        if (!view) continue;
        const p = cellToScreen(parseKey(k));
        view.x = p.x;
        view.y = p.y;
        root.addChild(view);
        views.set(k, { view, sig: signature(cell) });
      }
    },

    viewAt(a: Axial): Container | undefined {
      return views.get(key(a))?.view;
    },

    destroy(): void {
      for (const { view } of views.values()) view.destroy();
      views.clear();
      root.destroy({ children: true });
    },
  };
}
