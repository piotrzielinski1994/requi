import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { fixtureTree } from "./fixtures";

describe("WorkspaceLayout", () => {
  // AC-002 — behavior
  it("should render the tree and console together", () => {
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        consoleLines={["[12:00:00] Ready."]}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-token"
      >
        <WorkspaceLayout />
      </WorkspaceProvider>,
    );

    expect(
      screen.getByRole("tree", { name: /collection/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /console/i }),
    ).toBeInTheDocument();
  });
});
