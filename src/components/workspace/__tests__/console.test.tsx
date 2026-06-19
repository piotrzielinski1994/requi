import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { Console } from "@/components/workspace/console";
import { fixtureTree } from "./fixtures";

describe("Console", () => {
  // AC-012 — behavior
  it("should render each console log line", () => {
    const consoleLines = [
      "[12:00:00] Ready.",
      "[12:00:01] Loaded mock collection.",
      "[12:00:02] No active request.",
    ];

    render(
      <WorkspaceProvider
        tree={fixtureTree}
        consoleLines={consoleLines}
        initialExpandedIds={[]}
      >
        <Console />
      </WorkspaceProvider>,
    );

    const region = screen.getByRole("region", { name: /console/i });
    consoleLines.forEach((line) => {
      expect(within(region).getByText(line)).toBeInTheDocument();
    });
  });
});
