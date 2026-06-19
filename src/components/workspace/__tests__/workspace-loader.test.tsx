import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { WorkspaceLoader } from "@/components/workspace/workspace-loader";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { createInMemorySettingsStore } from "@/lib/settings/in-memory-store";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { createInMemoryWorkspaceFs } from "@/lib/workspace/in-memory-fs";
import { serialize } from "@/lib/workspace/disk-format";
import type { TreeNode } from "@/lib/workspace/model";

const sampleTree: TreeNode[] = [
  {
    kind: "folder",
    id: "pending",
    name: "Billing",
    config: {},
    children: [
      {
        kind: "request",
        id: "pending",
        name: "List Invoices",
        method: "GET",
        url: "https://api/invoices",
        body: "",
        config: {},
      },
    ],
  },
];

function renderLoader(workspacePath: string | undefined, workspaces = {}) {
  const settingsStore = createInMemorySettingsStore({
    ...DEFAULT_SETTINGS,
    workspacePath,
  });
  const fs = createInMemoryWorkspaceFs(workspaces);
  return render(
    <SettingsProvider store={settingsStore}>
      <WorkspaceLoader fs={fs} />
    </SettingsProvider>,
  );
}

describe("WorkspaceLoader", () => {
  // AC-011, TC-007 - behavior
  it("should render the loaded workspace tree if workspacePath points to a workspace", async () => {
    const files = serialize(sampleTree, "Demo");

    renderLoader("/ws/demo", { "/ws/demo": files });

    expect(await screen.findByText("Billing")).toBeInTheDocument();
  });

  // AC-013, TC-007 - behavior
  it("should show the empty state if no workspacePath is set", async () => {
    renderLoader(undefined);

    expect(await screen.findByText(/no workspace/i)).toBeInTheDocument();
    expect(screen.queryByText("Billing")).not.toBeInTheDocument();
  });

  // AC-013 - behavior
  it("should show the empty state if the workspacePath cannot be read", async () => {
    renderLoader("/ws/missing", {});

    expect(await screen.findByText(/no workspace/i)).toBeInTheDocument();
  });

  // AC-013, E-6 - behavior
  it("should show the empty state if the folder is not a workspace", async () => {
    renderLoader("/ws/bad", { "/ws/bad": { "stray.txt": "hello" } });

    expect(await screen.findByText(/no workspace/i)).toBeInTheDocument();
    expect(screen.queryByText("Billing")).not.toBeInTheDocument();
  });

  // AC-009, E-7 - behavior: partial load surfaces skipped files in the console
  it("should load the good nodes and surface a skipped malformed file", async () => {
    const files = {
      "requi.workspace.json": JSON.stringify({
        schemaVersion: 1,
        name: "Partial",
      }),
      "good.req.json": JSON.stringify({
        name: "Good Request",
        method: "GET",
        url: "https://api/good",
        body: "",
        config: {},
      }),
      "broken.req.json": "{ not valid json",
    };

    renderLoader("/ws/partial", { "/ws/partial": files });

    expect(await screen.findByText("Good Request")).toBeInTheDocument();
    expect(screen.getByText(/skipped malformed file/i)).toBeInTheDocument();
    expect(screen.getByText(/broken\.req\.json/)).toBeInTheDocument();
  });
});
