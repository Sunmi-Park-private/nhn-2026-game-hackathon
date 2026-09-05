// ui/loadProgress.ts — 에셋 로드 진행률. Pixi를 모른다 — 로더(skin.ts · hex/hexAssets.ts)가
// 한 장 시작할 때 begin, 끝날 때 end를 부르고, 부트 화면(main.ts)이 숫자를 읽어 보여 준다.
//
// 왜 있나: 부트가 에셋 ~100MB를 한꺼번에 받는다. 느린 회선(터널·모바일)에서는 몇 분이
// 걸리는데, 그동안 캔버스가 갈색 단색이면 「멎었다」와 「받는 중」을 구별할 수 없다.
// 예전에는 그 구별을 못 해서 4초 타임아웃을 두었고, 그 타임아웃이 느린 회선에서
// 멀쩡한 파일을 전부 폴백으로 만들었다(QA: 첫 접속은 깨진 화면, 새로고침하면 정상).

let started = 0;
let settled = 0;
const listeners = new Set<() => void>();

export interface LoadProgress { started: number; settled: number }

export function loadProgress(): LoadProgress { return { started, settled }; }

/** 한 장 받기 시작했다. */
export function beginLoad(): void { started += 1; notify(); }
/** 한 장이 끝났다 — 성공이든 실패든. 실패도 「기다릴 것이 하나 줄었다」는 뜻이다. */
export function endLoad(): void { settled += 1; notify(); }

/** 숫자가 바뀔 때마다 부른다. 돌려주는 함수로 뗀다. */
export function onLoadProgress(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notify(): void { for (const cb of listeners) cb(); }

/** 테스트 전용 — 모듈 상태를 비운다. */
export function resetLoadProgress(): void { started = 0; settled = 0; listeners.clear(); }
