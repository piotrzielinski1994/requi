import { describe, expect, it } from "vitest";

import {
  DEMO_RESPONSE,
  DEMO_WORKSPACE_PATH,
  demoConsoleLines,
  demoFiles,
  demoTree,
} from "@/lib/workspace/demo-seed";
import { deserialize } from "@/lib/workspace/disk-format";
import type { HttpResponse } from "@/lib/http/model";
import type { TreeNode } from "@/lib/workspace/model";

describe("demo seed", () => {
  // AC-003, AC-005, TC-005 - behavior: a non-empty demo tree exists to seed the dev build.
  it("should expose a non-empty demo tree", () => {
    const tree: TreeNode[] = demoTree;

    expect(tree.length).toBeGreaterThan(0);
  });

  // AC-005, TC-005 - behavior: the in-memory fs key + dev settings workspacePath is "demo".
  it("should pin the demo workspace path to demo", () => {
    expect(DEMO_WORKSPACE_PATH).toBe("demo");
  });

  // AC-003, AC-005, TC-005 - behavior: the seed survives the real disk format round-trip,
  // so the loader reads it back identically via deserialize.
  it("should round-trip the demo tree through serialize and deserialize", () => {
    const parsed = deserialize(demoFiles());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.tree).toEqual(demoTree);
  });

  // AC-003 - behavior: the console seed lines exist for the demo console.
  it("should expose demo console lines", () => {
    const lines: string[] = demoConsoleLines;

    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  // AC-005, AC-007b - behavior: the canned response is a 200 the fake HTTP client returns.
  it("should expose a canned 200 demo response", () => {
    const response: HttpResponse = DEMO_RESPONSE;

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe("string");
  });
});
