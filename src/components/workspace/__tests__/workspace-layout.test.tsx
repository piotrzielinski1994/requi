import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { createInMemorySettingsStore } from "@/lib/settings/in-memory-store";
import { fixtureTree } from "./fixtures";

describe("WorkspaceLayout", () => {
  // AC-002 — behavior
  it("should render the tree and console together", async () => {
    render(
      <SettingsProvider store={createInMemorySettingsStore()}>
        <WorkspaceProvider
          tree={fixtureTree}
          consoleLines={["[12:00:00] Ready."]}
          initialExpandedIds={["folder-auth", "folder-oauth"]}
          initialActiveRequestId="req-token"
        >
          <WorkspaceLayout />
        </WorkspaceProvider>
      </SettingsProvider>,
    );

    expect(
      await screen.findByRole("tree", { name: /collection/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /console/i }),
    ).toBeInTheDocument();
  });
});
