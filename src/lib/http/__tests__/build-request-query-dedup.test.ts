import { describe, it, expect } from "vitest";

import { buildHttpRequest } from "@/lib/http/build-request";
import type { EffectiveConfig } from "@/lib/workspace/resolve";
import type { Auth, RequestNode } from "@/lib/workspace/model";

const request = (
  overrides: Partial<RequestNode> & { id: string },
): RequestNode => ({
  kind: "request",
  name: overrides.name ?? overrides.id,
  method: "GET",
  url: "https://example.test/path",
  body: "",
  config: {},
  ...overrides,
});

const effectiveOf = (over: {
  variables?: Record<string, string>;
  params?: Record<string, string>;
  auth?: Auth;
  timeoutMs?: number;
}): EffectiveConfig => {
  const from = { scopeId: "test", scopeName: "test" };
  const wrapKeyed = (entries?: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(entries ?? {}).map(([k, v]) => [k, { value: v, from }]),
    );
  return {
    variables: wrapKeyed(over.variables),
    headers: {},
    params: wrapKeyed(over.params),
    auth: { value: over.auth ?? { type: "none" }, from },
    scripts: { pre: { value: "", from }, post: { value: "", from } },
    timeoutMs: { value: over.timeoutMs ?? 30000, from },
  };
};

describe("buildHttpRequest - query dedup by key (AC-015)", () => {
  // AC-015 - behavior: a key present in BOTH the url query and config.params is
  // sent once (the url value wins), not duplicated.
  it("should not duplicate a key that is in both the url and config.params", () => {
    const node = request({ id: "r", url: "https://api.com/get?qwe=123" });

    const wire = buildHttpRequest(node, effectiveOf({ params: { qwe: "123" } }));

    expect(wire.url).toBe("https://api.com/get?qwe=123");
  });

  // AC-015 - behavior: when the url and config.params disagree on a key's value,
  // the url value wins (it is the request's own mirror) and the param is not re-added.
  it("should let the url value win for a key present in both", () => {
    const node = request({ id: "r", url: "https://api.com/get?qwe=123" });

    const wire = buildHttpRequest(node, effectiveOf({ params: { qwe: "999" } }));

    expect(wire.url).toBe("https://api.com/get?qwe=123");
  });

  // AC-015, AC-016 - behavior: a folder-only param (key NOT in the url) still
  // appends, alongside the url's own query.
  it("should still append a config.params key that is not in the url", () => {
    const node = request({ id: "r", url: "https://api.com/get?qwe=123" });

    const wire = buildHttpRequest(node, effectiveOf({ params: { foo: "bar" } }));

    expect(wire.url).toBe("https://api.com/get?qwe=123&foo=bar");
  });
});
