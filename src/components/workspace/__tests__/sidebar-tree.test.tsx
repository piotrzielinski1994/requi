import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { SidebarTree } from "@/components/workspace/sidebar-tree";
import { ContentHeader } from "@/components/workspace/content-header";
import { fixtureTree } from "./fixtures";

describe("SidebarTree", () => {
  // AC-004, TC-002 — behavior
  it("should reveal a folder's children when a collapsed folder is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
        <SidebarTree />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    const auth = within(tree).getByRole("treeitem", { name: "Auth" });
    expect(auth).toHaveAttribute("aria-expanded", "false");
    expect(
      within(tree).queryByRole("treeitem", { name: "OAuth" }),
    ).not.toBeInTheDocument();

    await user.click(auth);

    expect(auth).toHaveAttribute("aria-expanded", "true");
    expect(
      within(tree).getByRole("treeitem", { name: "OAuth" }),
    ).toBeInTheDocument();
  });

  // AC-004, TC-002 — behavior
  it("should hide a folder's children when an expanded folder is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider tree={fixtureTree} initialExpandedIds={["folder-auth"]}>
        <SidebarTree />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    const auth = within(tree).getByRole("treeitem", { name: "Auth" });
    expect(auth).toHaveAttribute("aria-expanded", "true");
    expect(
      within(tree).getByRole("treeitem", { name: "OAuth" }),
    ).toBeInTheDocument();

    await user.click(auth);

    expect(auth).toHaveAttribute("aria-expanded", "false");
    expect(
      within(tree).queryByRole("treeitem", { name: "OAuth" }),
    ).not.toBeInTheDocument();
  });

  // AC-003 — behavior
  it("should show the method badge in a request leaf's label", () => {
    render(
      <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
        <SidebarTree />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    expect(
      within(tree).getByRole("treeitem", { name: "GET profile" }),
    ).toBeInTheDocument();
    expect(
      within(tree).getByRole("treeitem", { name: "DELETE session" }),
    ).toBeInTheDocument();
  });

  // AC-003, TC-003 — behavior
  it("should render a request nested three folders deep when its ancestors are expanded", () => {
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
      >
        <SidebarTree />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    expect(within(tree).getByRole("treeitem", { name: "Auth" })).toBeInTheDocument();
    expect(within(tree).getByRole("treeitem", { name: "OAuth" })).toBeInTheDocument();
    expect(
      within(tree).getByRole("treeitem", { name: "POST token" }),
    ).toBeInTheDocument();
  });

  // AC-005, TC-003 — behavior
  it("should select a request and open its tab when a request leaf is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
      >
        <SidebarTree />
        <ContentHeader />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    const token = within(tree).getByRole("treeitem", { name: "POST token" });
    expect(token).toHaveAttribute("aria-selected", "false");

    await user.click(token);

    expect(token).toHaveAttribute("aria-selected", "true");

    const tablist = screen.getByRole("tablist", { name: /open requests/i });
    expect(
      within(tablist).getByRole("tab", { name: "token" }),
    ).toBeInTheDocument();
  });

  // AC-006, E-2 — behavior
  it("should not open a request tab when a folder is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
        <SidebarTree />
        <ContentHeader />
      </WorkspaceProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    await user.click(within(tree).getByRole("treeitem", { name: "Auth" }));

    const tablist = screen.getByRole("tablist", { name: /open requests/i });
    expect(within(tablist).queryByRole("tab")).not.toBeInTheDocument();
  });
});
