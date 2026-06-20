import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { UrlBar } from "@/components/workspace/url-bar";
import { fixtureTree } from "./fixtures";

describe("UrlBar", () => {
  // AC-008 — behavior
  it("should show the active request's method and url", () => {
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-token"
      >
        <UrlBar />
      </WorkspaceProvider>,
    );

    const bar = screen.getByRole("group", { name: /url bar/i });
    expect(within(bar).getByText("POST")).toBeInTheDocument();

    const urlBox = within(bar).getByRole("textbox", { name: /url/i });
    expect(urlBox).toHaveValue("{{baseUrl}}/oauth/token");

    expect(
      within(bar).getByRole("button", { name: /send/i }),
    ).toBeInTheDocument();
  });

  // AC-008, E-1 — behavior
  it("should show an empty state when no request is active", () => {
    render(
      <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
        <UrlBar />
      </WorkspaceProvider>,
    );

    const bar = screen.getByRole("group", { name: /url bar/i });
    expect(within(bar).getByText(/no request selected/i)).toBeInTheDocument();
  });
});
