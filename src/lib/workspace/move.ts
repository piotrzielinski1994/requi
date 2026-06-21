import type { TreeNode } from "@/lib/workspace/model";
import {
  containsId,
  findNode,
  insertNode,
  removeNode,
} from "@/lib/workspace/tree-edit";

export type MoveTarget = { parentId: string | null; index: number };

export function moveNode(
  tree: TreeNode[],
  dragId: string,
  target: MoveTarget,
): TreeNode[] {
  const dragged = findNode(tree, dragId);
  if (!dragged) {
    return tree;
  }
  if (target.parentId !== null) {
    const parent = findNode(tree, target.parentId);
    if (!parent || parent.kind !== "folder") {
      return tree;
    }
    if (containsId(dragged, target.parentId)) {
      return tree;
    }
  }
  const without = removeNode(tree, dragId);
  return insertNode(without, target.parentId, target.index, dragged);
}
