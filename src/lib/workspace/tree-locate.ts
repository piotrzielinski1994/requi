import type { TreeNode } from "@/lib/workspace/model";
import type { MoveTarget } from "@/lib/workspace/move";

export type NodeLocation = { parentId: string | null; index: number };

export function locateNode(
  nodes: TreeNode[],
  id: string,
  parentId: string | null = null,
): NodeLocation | null {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) {
    return { parentId, index };
  }
  for (const node of nodes) {
    if (node.kind === "folder") {
      const found = locateNode(node.children, id, node.id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.kind === "folder") {
      const found = findNode(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export type DropPosition = "before" | "after" | "inside";

export function dropTarget(
  tree: TreeNode[],
  overId: string,
  position: DropPosition,
): MoveTarget | null {
  if (position === "inside") {
    const over = findNode(tree, overId);
    if (!over || over.kind !== "folder") {
      return null;
    }
    return { parentId: overId, index: over.children.length };
  }
  const location = locateNode(tree, overId);
  if (!location) {
    return null;
  }
  const index = position === "before" ? location.index : location.index + 1;
  return { parentId: location.parentId, index };
}
