import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHOD_COLOR } from "@/components/workspace/method-color";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type {
  FolderNode,
  RequestNode,
  TreeNode,
} from "@/components/workspace/mock-data";

function FolderRow({ node, depth }: { node: FolderNode; depth: number }) {
  const { expandedFolderIds, selectedNodeId, selectNode } = useWorkspace();
  const isExpanded = expandedFolderIds.has(node.id);
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <li>
      <div
        role="treeitem"
        aria-expanded={isExpanded}
        aria-selected={selectedNodeId === node.id}
        tabIndex={0}
        onClick={() => selectNode(node.id)}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className={cn(
          "flex cursor-pointer items-center gap-1 py-1 pr-2 text-[13px] hover:bg-accent",
          selectedNodeId === node.id && "bg-accent",
        )}
      >
        <Chevron className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </div>
      {isExpanded ? (
        <ul role="group">
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function RequestRow({ node, depth }: { node: RequestNode; depth: number }) {
  const { selectedNodeId, selectNode } = useWorkspace();

  return (
    <li>
      <div
        role="treeitem"
        aria-selected={selectedNodeId === node.id}
        aria-label={`${node.method} ${node.name}`}
        tabIndex={0}
        onClick={() => selectNode(node.id)}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={cn(
          "flex cursor-pointer items-center gap-2 py-1 pr-2 text-[13px] hover:bg-accent",
          selectedNodeId === node.id && "bg-accent",
        )}
      >
        <span
          className={cn(
            "shrink-0 font-mono text-[12px]",
            METHOD_COLOR[node.method],
          )}
        >
          {node.method}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
    </li>
  );
}

export function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  if (node.kind === "folder") {
    return <FolderRow node={node} depth={depth} />;
  }
  return <RequestRow node={node} depth={depth} />;
}
