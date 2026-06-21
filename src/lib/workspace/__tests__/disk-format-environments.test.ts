import { describe, it, expect } from "vitest";

import { serialize, deserialize } from "@/lib/workspace/disk-format";
import type { FolderNode, RequestNode, TreeNode } from "@/lib/workspace/model";

const request = (
  name: string,
  config: RequestNode["config"] = {},
): RequestNode => ({
  kind: "request",
  id: `pending-${name}`,
  name,
  method: "GET",
  url: `https://example.test/${name}`,
  body: "",
  config,
});

const folder = (
  name: string,
  config: FolderNode["config"],
  children: TreeNode[],
): FolderNode => ({
  kind: "folder",
  id: `pending-${name}`,
  name,
  config,
  children,
});

const expectOk = (result: ReturnType<typeof deserialize>) => {
  if (!result.ok) {
    throw new Error(`expected ok result, got error: ${result.error}`);
  }
  return result;
};

describe("disk-format environments round-trip", () => {
  // AC-001 - behavior: a folder config's environments block survives serialize/deserialize
  it("should round-trip a folder config environments block intact", () => {
    const environments = {
      local: { baseUrl: "http://localhost:3000" },
      prod: { baseUrl: "https://api.example.com", apiKey: "k1" },
    };
    const tree: TreeNode[] = [
      folder(
        "Api",
        { variables: { baseUrl: "https://default" }, environments },
        [request("Get")],
      ),
    ];

    const result = expectOk(deserialize(serialize(tree)));
    const loaded = result.tree.find(
      (node): node is FolderNode =>
        node.kind === "folder" && node.name === "Api",
    );

    expect(loaded?.config.environments).toEqual(environments);
  });

  // AC-001 - behavior: a request-level environments block also round-trips
  it("should round-trip a request config environments block intact", () => {
    const environments = { prod: { token: "{{process.env.JWT}}" } };
    const tree: TreeNode[] = [request("Token", { environments })];

    const result = expectOk(deserialize(serialize(tree)));
    const loaded = result.tree.find(
      (node): node is RequestNode =>
        node.kind === "request" && node.name === "Token",
    );

    expect(loaded?.config.environments).toEqual(environments);
  });

  // AC-001 - behavior: a hand-written folder.json with environments deserializes
  it("should parse an environments block from a hand-built folder.json", () => {
    const files = serialize([]);
    files["api/folder.json"] = JSON.stringify({
      name: "Api",
      config: {
        environments: {
          local: { baseUrl: "http://localhost:3000" },
          prod: { baseUrl: "https://api.example.com" },
        },
      },
    });
    files["api/get.req.json"] = JSON.stringify({
      name: "Get",
      method: "GET",
      url: "{{baseUrl}}/get",
      body: "",
      config: {},
    });

    const result = expectOk(deserialize(files));
    const api = result.tree.find(
      (node): node is FolderNode =>
        node.kind === "folder" && node.name === "Api",
    );

    expect(api?.config.environments).toEqual({
      local: { baseUrl: "http://localhost:3000" },
      prod: { baseUrl: "https://api.example.com" },
    });
  });
});
