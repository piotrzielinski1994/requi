import { describe, it, expect } from "vitest";

import { serialize, deserialize } from "@/lib/workspace/disk-format";
import type { FileMap } from "@/lib/workspace/disk-format";
import type { RequestNode, TreeNode } from "@/lib/workspace/model";

const request = (
  name: string,
  overrides: Partial<RequestNode> = {},
): RequestNode => ({
  kind: "request",
  id: `pending-${name}`,
  name,
  method: "GET",
  url: `https://example.test/${name}/:id`,
  body: "",
  config: {},
  ...overrides,
});

const expectOk = (result: ReturnType<typeof deserialize>) => {
  if (!result.ok) {
    throw new Error(`expected ok result, got error: ${result.error}`);
  }
  return result;
};

const loadedRequest = (
  result: ReturnType<typeof expectOk>,
  name: string,
): RequestNode => {
  const node = result.tree.find(
    (n): n is RequestNode => n.kind === "request" && n.name === name,
  );
  if (!node) {
    throw new Error(`request ${name} not found in deserialized tree`);
  }
  return node;
};

const reqJson = (map: FileMap, slugPrefix: string): Record<string, unknown> => {
  const entry = Object.entries(map).find(
    ([path]) => path.startsWith(slugPrefix) && path.endsWith(".req.json"),
  );
  if (!entry) {
    throw new Error(`no ${slugPrefix}*.req.json emitted`);
  }
  return JSON.parse(entry[1]) as Record<string, unknown>;
};

describe("disk-format request pathParams round-trip (AC-008, TC-010)", () => {
  // AC-008, TC-010 - behavior: a request's pathParams map survives serialize then
  // deserialize, value-for-value.
  it("should round-trip a request's pathParams through serialize then deserialize", () => {
    const tree: TreeNode[] = [
      request("Get User", { pathParams: { id: "42", postId: "{{p}}" } }),
    ];

    const result = expectOk(deserialize(serialize(tree)));

    expect(loadedRequest(result, "Get User").pathParams).toEqual({
      id: "42",
      postId: "{{p}}",
    });
  });

  // AC-008, TC-010 - behavior: a reloaded tree still carries the pathParams, AND
  // re-serializing it is byte-identical for the request file (emitted stably). The
  // value assertion guards against a tautological byte-compare of two empty emits.
  it("should re-serialize a request with pathParams byte-identically through a reload", () => {
    const tree: TreeNode[] = [request("Get", { pathParams: { id: "7" } })];

    const firstMap = serialize(tree);
    const reloaded = expectOk(deserialize(firstMap));
    const secondMap = serialize(reloaded.tree);

    expect(loadedRequest(reloaded, "Get").pathParams).toEqual({ id: "7" });
    const key = Object.keys(firstMap).find((path) =>
      path.endsWith(".req.json"),
    );
    expect(key).toBeDefined();
    expect(firstMap[key!]).toContain("pathParams");
    expect(secondMap[key!]).toBe(firstMap[key!]);
  });
});

describe("disk-format pathParams emit-only-when-non-empty (AC-008)", () => {
  // AC-008, TC-010 - side-effect-contract: a request with at least one path param
  // writes pathParams into its *.req.json.
  it("should write pathParams into the req.json if the request has at least one", () => {
    const tree: TreeNode[] = [request("Get", { pathParams: { id: "9" } })];

    expect(reqJson(serialize(tree), "get").pathParams).toEqual({ id: "9" });
  });

  // AC-008, TC-010 - side-effect-contract: an empty pathParams is NOT emitted, while
  // a non-empty sibling IS (paired so a green run proves only the empty case is
  // omitted, not that the field is never written).
  it("should omit pathParams from the req.json if the map is empty", () => {
    const tree: TreeNode[] = [
      request("Empty", { pathParams: {} }),
      request("Filled", { pathParams: { id: "9" } }),
    ];

    const map = serialize(tree);

    expect(reqJson(map, "empty")).not.toHaveProperty("pathParams");
    expect(reqJson(map, "filled").pathParams).toEqual({ id: "9" });
  });

  // AC-008 - behavior: a request with no pathParams field at all omits it after a
  // round-trip; a sibling WITH path params still carries it (paired, non-tautological).
  it("should leave a request without a pathParams field if it never had one", () => {
    const tree: TreeNode[] = [
      request("Plain"),
      request("WithParams", { pathParams: { id: "1" } }),
    ];

    const result = expectOk(deserialize(serialize(tree)));

    expect(loadedRequest(result, "Plain")).not.toHaveProperty("pathParams");
    expect(loadedRequest(result, "WithParams").pathParams).toEqual({ id: "1" });
  });
});

describe("disk-format pathParams sanitize (AC-008, E-7)", () => {
  // Each garbage case is paired with a VALID sibling request ("Good", id=42) so a
  // green run proves the field is actually READ + validated - not merely never read
  // (which would make a bare "garbage -> undefined" assertion tautological).
  const reqJsonWith = (pathParams: unknown): FileMap => ({
    "requi.workspace.json": JSON.stringify({ schemaVersion: 3, name: "W" }),
    "get.req.json": JSON.stringify({
      name: "Get",
      method: "GET",
      url: "https://api/users/:id",
      body: "",
      config: {},
      order: 0,
      pathParams,
    }),
    "good.req.json": JSON.stringify({
      name: "Good",
      method: "GET",
      url: "https://api/users/:id",
      body: "",
      config: {},
      order: 1,
      pathParams: { id: "42" },
    }),
  });

  const expectGoodSiblingKept = (result: ReturnType<typeof expectOk>) =>
    expect(loadedRequest(result, "Good").pathParams).toEqual({ id: "42" });

  // AC-008, E-7 - behavior: a non-string value entry is dropped while a valid
  // sibling entry in the SAME map survives.
  it("should drop a non-string pathParam entry but keep a valid sibling entry", () => {
    const result = expectOk(
      deserialize(reqJsonWith({ bad: 123, id: "42" })),
    );

    expect(loadedRequest(result, "Get").pathParams).toEqual({ id: "42" });
  });

  // AC-008, E-7 - behavior: a nested-object value entry is dropped, valid sibling kept.
  it("should drop an object-valued pathParam entry but keep a valid sibling entry", () => {
    const result = expectOk(
      deserialize(reqJsonWith({ bad: { nested: true }, id: "42" })),
    );

    expect(loadedRequest(result, "Get").pathParams).toEqual({ id: "42" });
  });

  // AC-008, E-7 - behavior: when NO entry survives, the field is dropped entirely;
  // the request otherwise intact + the colored... err, valid sibling request kept.
  it("should drop pathParams entirely if no entry is a string, keeping the rest", () => {
    const result = expectOk(deserialize(reqJsonWith({ a: 1, b: null })));
    const loaded = loadedRequest(result, "Get");

    expect(loaded.pathParams).toBeUndefined();
    expect(loaded.url).toBe("https://api/users/:id");
    expectGoodSiblingKept(result);
  });

  // AC-008, E-7 - behavior: a non-object pathParams (a string) is dropped, request
  // + valid sibling intact, no crash.
  it("should drop a non-object pathParams but keep the rest of the request", () => {
    const result = expectOk(deserialize(reqJsonWith("not-an-object")));
    const loaded = loadedRequest(result, "Get");

    expect(loaded.pathParams).toBeUndefined();
    expect(loaded.url).toBe("https://api/users/:id");
    expectGoodSiblingKept(result);
  });

  // AC-008, E-7 - behavior: a numeric pathParams leaves the request loadable (no
  // crash); a valid sibling still loads (proving the field is read).
  it("should still load the request normally if pathParams is a number", () => {
    const result = expectOk(deserialize(reqJsonWith(42)));
    const loaded = loadedRequest(result, "Get");

    expect(loaded.pathParams).toBeUndefined();
    expect(loaded.name).toBe("Get");
    expectGoodSiblingKept(result);
  });
});
