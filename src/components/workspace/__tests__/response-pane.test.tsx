import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { ResponsePane } from "@/components/workspace/response-pane";
import { fixtureTree } from "./fixtures";

describe("ResponsePane", () => {
  // AC-010 — behavior
  it("should show the response status and time", () => {
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-token"
      >
        <ResponsePane />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /response sections/i });
    expect(within(tablist).getByRole("tab", { name: "Response" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Headers" })).toBeInTheDocument();

    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText(/142\s*ms/)).toBeInTheDocument();

    // Response panel visible by default: shows the response body.
    expect(screen.getByText(/access_token/)).toBeInTheDocument();
  });

  // AC-010 — behavior
  it("should show response headers after clicking the Headers tab", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-token"
      >
        <ResponsePane />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /response sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Headers" }));

    expect(screen.getByText("X-Response-Header")).toBeInTheDocument();
    expect(screen.getByText("resp-value")).toBeInTheDocument();
  });
});
