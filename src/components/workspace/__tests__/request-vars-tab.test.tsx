import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { RequestPane } from "@/components/workspace/request-pane";
import type { TreeNode } from "@/lib/workspace/model";

const tree: TreeNode[] = [
  {
    kind: "request",
    id: "req",
    name: "Req",
    method: "GET",
    url: "{{token}}/get",
    body: "",
    config: {
      variables: { token: "tok-123", scope: "read" },
    },
  },
  {
    kind: "request",
    id: "req-empty",
    name: "Empty",
    method: "GET",
    url: "https://api/get",
    body: "",
    config: {},
  },
];

function renderPane(initialActiveRequestId: string) {
  return render(
    <WorkspaceProvider tree={tree} initialActiveRequestId={initialActiveRequestId}>
      <RequestPane />
    </WorkspaceProvider>,
  );
}

describe("RequestPane Vars tab", () => {
  // behavior: a Vars tab exists in the request sections
  it("should expose a Vars tab in the request sections", () => {
    renderPane("req");

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    expect(within(tablist).getByRole("tab", { name: "Vars" })).toBeInTheDocument();
  });

  // behavior: the Vars tab lists the request's own variables (key + value)
  it("should list the request's own variables if the Vars tab is opened", async () => {
    const user = userEvent.setup();
    renderPane("req");

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Vars" }));

    expect(screen.getByText("token")).toBeInTheDocument();
    expect(screen.getByText("tok-123")).toBeInTheDocument();
    expect(screen.getByText("scope")).toBeInTheDocument();
    expect(screen.getByText("read")).toBeInTheDocument();
  });

  // behavior: an empty-variables request shows an empty hint, not a crash
  it("should show an empty hint if the request defines no variables", async () => {
    const user = userEvent.setup();
    renderPane("req-empty");

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Vars" }));

    expect(screen.getByText(/no variables/i)).toBeInTheDocument();
  });
});
