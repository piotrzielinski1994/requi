import { SidebarTree } from "@/components/workspace/sidebar-tree";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { EnvSelector } from "./env-selector";

export function Sidebar() {
  const { openEnvEditor } = useWorkspace();

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex h-9 shrink-0 items-center border-b pl-3 text-sm font-semibold justify-between">
        ReqUI
        <div className="flex h-full items-stretch">
          <button
            type="button"
            aria-label="Edit .env"
            onClick={openEnvEditor}
            className="border-l px-3 text-xs font-normal text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            .env
          </button>
          <EnvSelector />
        </div>
      </div>
      <SidebarTree />
    </div>
  );
}
