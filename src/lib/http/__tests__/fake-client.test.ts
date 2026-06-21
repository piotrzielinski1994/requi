import { describe, it, expect } from "vitest";

import { createFakeHttpClient } from "@/lib/http/fake-client";

describe("createFakeHttpClient - cancel", () => {
  // TC-008, AC-007 - side-effect-contract: cancel is a no-op that resolves.
  it("should resolve without throwing if cancel is called", async () => {
    const client = createFakeHttpClient();

    await expect(client.cancel("any-id")).resolves.toBeUndefined();
  });
});
