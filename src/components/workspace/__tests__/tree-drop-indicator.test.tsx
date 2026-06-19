import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { TreeRow } from "@/components/workspace/tree-row";
import {
  TreeDndProvider,
  type DropIndicator,
} from "@/components/workspace/tree-dnd";
import { fixtureTree } from "./fixtures";
import type { TreeNode } from "@/lib/workspace/model";

function renderRow(node: TreeNode, indicator: DropIndicator | null) {
  return render(
    <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
      <DndContext>
        <TreeDndProvider value={{ activeId: "req-session", indicator }}>
          <ul>
            <TreeRow node={node} depth={0} />
          </ul>
        </TreeDndProvider>
      </DndContext>
    </WorkspaceProvider>,
  );
}

const sessionRequest = fixtureTree.find(
  (node): node is TreeNode => node.id === "req-session",
)!;
const usersFolder = fixtureTree.find(
  (node): node is TreeNode => node.id === "folder-users",
)!;

describe("tree drop indicator (AC-009)", () => {
  // AC-009 - behavior: a "before" indicator renders an insertion line
  it("should render a drop line if the indicator points before this row", () => {
    renderRow(sessionRequest, { overId: "req-session", position: "before" });

    expect(screen.getByTestId("drop-line")).toBeInTheDocument();
  });

  // AC-009 - behavior: a row with no matching indicator shows no line
  it("should not render a drop line if the indicator points at another row", () => {
    renderRow(sessionRequest, { overId: "folder-users", position: "before" });

    expect(screen.queryByTestId("drop-line")).not.toBeInTheDocument();
  });

  // AC-009 - behavior: an "inside" indicator highlights the folder row
  it("should highlight a folder row if the indicator points inside it", () => {
    renderRow(usersFolder, { overId: "folder-users", position: "inside" });

    const row = screen.getByRole("treeitem", { name: "Users" });
    expect(row.className).toMatch(/ring/);
    // No insertion line for an inside-drop.
    expect(screen.queryByTestId("drop-line")).not.toBeInTheDocument();
  });

  // AC-009 - behavior: no indicator means no affordance
  it("should render neither line nor highlight if there is no indicator", () => {
    renderRow(usersFolder, null);

    expect(screen.queryByTestId("drop-line")).not.toBeInTheDocument();
    const row = screen.getByRole("treeitem", { name: "Users" });
    expect(row.className).not.toMatch(/ring/);
  });
});
