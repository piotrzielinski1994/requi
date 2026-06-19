import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { RequestPane } from "@/components/workspace/request-pane";
import type { TreeNode } from "@/lib/workspace/model";

const tree: TreeNode[] = [
  {
    kind: "folder",
    id: "f-oauth",
    name: "OAuth",
    config: {
      variables: { baseUrl: "https://stg.api" },
      auth: { type: "bearer", token: "ey.inherited" },
    },
    children: [
      {
        kind: "request",
        id: "r-token",
        name: "token",
        method: "POST",
        url: "{{baseUrl}}/token",
        body: "",
        config: {
          variables: { scope: "read write" },
          auth: { type: "inherit" },
        },
      },
    ],
  },
];

function renderEffective() {
  return render(
    <WorkspaceProvider
      tree={tree}
      consoleLines={[]}
      initialExpandedIds={["f-oauth"]}
      initialActiveRequestId="r-token"
    >
      <RequestPane />
    </WorkspaceProvider>,
  );
}

describe("Effective config tab", () => {
  // AC-014, TC-009 - behavior
  it("should list resolved variables with their provenance if the Effective tab is open", async () => {
    const user = userEvent.setup();
    renderEffective();

    await user.click(screen.getByRole("tab", { name: /effective/i }));

    expect(await screen.findByText("https://stg.api")).toBeInTheDocument();
    expect(screen.getByText("read write")).toBeInTheDocument();
    // baseUrl came from the folder; scope from the request.
    expect(screen.getAllByText(/OAuth/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/token/).length).toBeGreaterThan(0);
  });

  // AC-014 - behavior
  it("should show the resolved inherited auth if the request auth is inherit", async () => {
    const user = userEvent.setup();
    renderEffective();

    await user.click(screen.getByRole("tab", { name: /effective/i }));

    expect(await screen.findByText("ey.inherited")).toBeInTheDocument();
  });
});
