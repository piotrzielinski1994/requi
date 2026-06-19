import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { SidebarTree } from "@/components/workspace/sidebar-tree";
import { ContentHeader } from "@/components/workspace/content-header";
import { fixtureTree } from "./fixtures";

describe("ContentHeader", () => {
  // AC-007 — behavior
  it("should make a tab active when it is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-profile"
      >
        <SidebarTree />
        <ContentHeader />
      </WorkspaceProvider>,
    );

    // Open a second tab (token) by selecting it in the tree; profile is already open+active.
    const tree = screen.getByRole("tree", { name: /collection/i });
    await user.click(within(tree).getByRole("treeitem", { name: "POST token" }));

    const tablist = screen.getByRole("tablist", { name: /open requests/i });
    const profileTab = within(tablist).getByRole("tab", { name: "profile" });
    const tokenTab = within(tablist).getByRole("tab", { name: "token" });

    expect(tokenTab).toHaveAttribute("aria-selected", "true");
    expect(profileTab).toHaveAttribute("aria-selected", "false");

    await user.click(profileTab);

    expect(profileTab).toHaveAttribute("aria-selected", "true");
    expect(tokenTab).toHaveAttribute("aria-selected", "false");
  });

  // AC-007, TC-005 — behavior
  it("should remove a tab when its close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-profile"
      >
        <SidebarTree />
        <ContentHeader />
      </WorkspaceProvider>,
    );

    // Open a second tab so two are present.
    const tree = screen.getByRole("tree", { name: /collection/i });
    await user.click(within(tree).getByRole("treeitem", { name: "POST token" }));

    const tablist = screen.getByRole("tablist", { name: /open requests/i });
    expect(within(tablist).getByRole("tab", { name: "profile" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "token" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close token" }));

    expect(
      within(tablist).queryByRole("tab", { name: "token" }),
    ).not.toBeInTheDocument();
    expect(
      within(tablist).getByRole("tab", { name: "profile" }),
    ).toBeInTheDocument();
  });

  // AC-007, E-3 — behavior
  it("should not open a duplicate tab when an already-open request is reselected", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-token"
      >
        <SidebarTree />
        <ContentHeader />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    const tablist = screen.getByRole("tablist", { name: /open requests/i });

    expect(within(tablist).getAllByRole("tab", { name: "token" })).toHaveLength(1);

    await user.click(within(tree).getByRole("treeitem", { name: "POST token" }));

    expect(within(tablist).getAllByRole("tab", { name: "token" })).toHaveLength(1);
  });

  // AC-007, E-4 — behavior
  it("should activate an adjacent tab when the active tab is closed", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-profile"
      >
        <SidebarTree />
        <ContentHeader />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    await user.click(within(tree).getByRole("treeitem", { name: "POST token" }));

    const tablist = screen.getByRole("tablist", { name: /open requests/i });
    // token is now active (last selected); close it -> profile becomes active
    await user.click(screen.getByRole("button", { name: "Close token" }));

    expect(
      within(tablist).getByRole("tab", { name: "profile" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  // AC-007, E-4 — behavior
  it("should leave no active tab when the last open tab is closed", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={[]}
        initialActiveRequestId="req-profile"
      >
        <ContentHeader />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /open requests/i });
    expect(within(tablist).getByRole("tab", { name: "profile" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close profile" }));

    expect(within(tablist).queryByRole("tab")).not.toBeInTheDocument();
  });

  // AC-007 — behavior
  it("should render a New request control when the header is shown", () => {
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={[]}
        initialActiveRequestId="req-profile"
      >
        <ContentHeader />
      </WorkspaceProvider>,
    );

    expect(
      screen.getByRole("button", { name: /new request/i }),
    ).toBeInTheDocument();
  });
});
