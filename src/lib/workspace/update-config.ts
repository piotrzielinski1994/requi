import type { ConfigScope, TreeNode } from "@/lib/workspace/model";

export function updateNodeConfig(
  tree: TreeNode[],
  id: string,
  config: ConfigScope,
): TreeNode[] {
  return tree.map((node) => {
    if (node.id === id) {
      return { ...node, config };
    }
    if (node.kind === "folder") {
      return { ...node, children: updateNodeConfig(node.children, id, config) };
    }
    return node;
  });
}
