// ui/layoutHistory.ts — 되돌리기·다시. 두 에디터(/ui.html, ?editor=1)가 함께 쓴다.
//
// 스냅샷 방식이다. 배치 데이터가 작고(수십 개 슬롯) 편집이 드문드문 일어나므로,
// 조작마다 무엇이 바뀌었는지 추적하는 것보다 통째로 찍어 두는 쪽이 단순하고 안전하다.
// 값이 그대로면 기록하지 않으므로, 같은 자리를 여러 번 눌러도 히스토리가 늘지 않는다.

export interface History<T> {
  /** 지금 상태를 기록한다. 직전과 같으면 아무 일도 안 한다. */
  record(state: T): void;
  /** 한 단계 전으로. 돌아갈 곳이 없으면 null. */
  undo(): T | null;
  /** 되돌리기를 취소한다. 앞이 없으면 null. */
  redo(): T | null;
  canUndo(): boolean;
  canRedo(): boolean;
  /** 히스토리를 비우고 이 상태를 시작점으로 삼는다. */
  reset(state: T): void;
}

/** 스냅샷 상한. 넘으면 오래된 것부터 버린다 — 배치 편집에 100단계면 충분하다. */
const LIMIT = 100;

export function createHistory<T>(initial: T): History<T> {
  const dump = (s: T): string => JSON.stringify(s);
  const load = (s: string): T => JSON.parse(s) as T;

  let present = dump(initial);
  const past: string[] = [];
  const future: string[] = [];

  return {
    record(state: T): void {
      const next = dump(state);
      if (next === present) return; // 값이 그대로면 단계로 치지 않는다
      past.push(present);
      if (past.length > LIMIT) past.shift();
      present = next;
      // 새 편집이 들어오면 앞으로 갈 길은 사라진다 — 분기를 남기지 않는다
      future.length = 0;
    },

    undo(): T | null {
      const prev = past.pop();
      if (prev === undefined) return null;
      future.push(present);
      present = prev;
      return load(present);
    },

    redo(): T | null {
      const next = future.pop();
      if (next === undefined) return null;
      past.push(present);
      present = next;
      return load(present);
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    reset(state: T): void {
      present = dump(state);
      past.length = 0;
      future.length = 0;
    },
  };
}

/**
 * 스냅샷을 **제자리에** 되돌린다.
 *
 * 배열을 통째로 갈아끼우면 화면이 들고 있는 슬롯 참조가 끊겨, 되돌린 값이 반영되지
 * 않거나 다음 편집이 유령 객체를 고친다. 같은 객체의 속성만 덮어써 참조를 지킨다.
 */
export function restoreInto(
  target: Array<{ id: string; slots: Array<Record<string, unknown>> }>,
  snapshot: Array<{ id: string; slots: Array<Record<string, unknown>> }>,
): void {
  for (const area of target) {
    const src = snapshot.find((a) => a.id === area.id);
    if (!src) continue;
    for (const slot of area.slots) {
      const from = src.slots.find((s) => s["id"] === slot["id"]);
      if (!from) continue;
      // 사라진 키(초기화한 색·배율 등)까지 반영해야 한다 — 덮어쓰기만 하면 남는다
      for (const k of Object.keys(slot)) if (!(k in from)) delete slot[k];
      Object.assign(slot, from);
    }
  }
}
