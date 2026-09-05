// tests/ui/editorServer.test.ts — 빌드본에서 에디터를 열었을 때 원인이 보이는 오류가 나는지.
//
// QA에서 「실패: SyntaxError: Unexpected token '<', "<!doctype "...」가 나왔다.
// 원인은 저장 서버가 없는 빌드본이었는데, 메시지가 그 사실을 말하지 않았다.
import { describe, it, expect } from "vitest";
import { readJson, NO_EDITOR_SERVER } from "../../src/ui/editorServer";

describe("readJson", () => {
  it("SPA 폴백 HTML이 오면 서버가 없다고 말한다 — JSON.parse 오류를 내지 않는다", async () => {
    const html = new Response("<!doctype html><html></html>", {
      status: 200, headers: { "content-type": "text/html" },
    });
    await expect(readJson(html)).rejects.toThrow(NO_EDITOR_SERVER);
    await expect(readJson(html.clone())).rejects.not.toThrow(SyntaxError);
  });

  it("content-type이 없어도 같다 — vite preview의 404가 그렇다", async () => {
    const empty = new Response(null, { status: 404 });
    await expect(readJson(empty)).rejects.toThrow("content-type 없음");
  });

  it("JSON이면 그대로 읽는다", async () => {
    const ok = new Response('{"areas":[]}', { headers: { "content-type": "application/json" } });
    await expect(readJson(ok)).resolves.toEqual({ areas: [] });
  });
});
