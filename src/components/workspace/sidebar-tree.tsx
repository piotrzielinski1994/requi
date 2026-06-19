import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { TreeRow } from "@/components/workspace/tree-row";

export function SidebarTree() {
  const { tree } = useWorkspace();

  return (
    <ScrollArea className="flex-1">
      <ul role="tree" aria-label="Collection">
        {tree.map((node) => (
          <TreeRow key={node.id} node={node} depth={0} />
        ))}
      </ul>
    </ScrollArea>
  );
}
