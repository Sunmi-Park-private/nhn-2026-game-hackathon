// ui/editorServer.ts — 에디터의 저장 서버가 있는지. 두 에디터(/ui.html · ?editor=1)가 함께 쓴다.
//
// 배치 저장(/__uilayout)·에셋 업로드(/__upload)는 vite.config.ts의 플러그인이
// `apply: 'serve'`라 **dev 서버에만** 붙는다. 빌드본(vite preview · npm run share)에는
// 그 경로가 없고, 없는 경로는 SPA 폴백으로 index.html을 200으로 돌려준다.
// 그것을 JSON으로 읽으면 이렇게 터졌다:
//
//   실패: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
//
// 이 메시지로는 아무도 원인을 못 찾는다(QA에서 실제로 그랬다). 서버가 없다는 사실은
// 에디터가 **먼저** 말해야 한다. 빌드본에 쓰기 엔드포인트를 붙이는 쪽은 택하지 않는다 —
// 공개 URL이면 누구나 파일을 덮어쓸 수 있다(CLAUDE.md 「레이아웃 에디터는 dev 서버에서만」).

/** 저장·업로드 서버가 붙어 있는가. 플러그인이 `apply: 'serve'`이므로 dev 빌드와 정확히 일치한다. */
export const hasEditorServer = (): boolean => import.meta.env.DEV;

export const NO_EDITOR_SERVER =
  "이 서버는 빌드본이라 저장·업로드가 안 됩니다 — npm run dev (localhost:5173)에서 여세요";

/** JSON 응답만 받는다. SPA 폴백 HTML이 오면 JSON.parse 오류 대신 원인이 보이는 오류를 낸다. */
export async function readJson(r: Response): Promise<unknown> {
  const type = r.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    throw new Error(`${NO_EDITOR_SERVER} (응답이 JSON이 아닙니다: ${type || "content-type 없음"})`);
  }
  return r.json() as Promise<unknown>;
}
