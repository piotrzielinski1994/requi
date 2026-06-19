import { useWorkspace } from "@/components/workspace/workspace-context";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { METHOD_COLOR } from "@/components/workspace/method-color";

export function ContentHeader() {
  const {
    openRequestIds,
    activeRequestId,
    requestsById,
    setActiveRequest,
    closeRequest,
  } = useWorkspace();

  return (
    <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-muted/30">
      <div
        role="tablist"
        aria-label="Open requests"
        className="flex h-full items-stretch"
      >
        {openRequestIds.map((id) => {
          const request = requestsById.get(id);
          if (!request) {
            return null;
          }
          const isActive = id === activeRequestId;
          return (
            <div
              key={id}
              className={cn(
                "flex h-full items-center gap-1 border-r px-3 text-sm hover:bg-accent",
                isActive
                  ? "-mb-px h-[calc(100%+1px)] bg-accent shadow-[inset_0_-2px_0_0_var(--primary)]"
                  : "bg-transparent",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveRequest(id)}
                className={cn(
                  "flex items-center gap-1.5 truncate",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 font-mono text-[11px]",
                    METHOD_COLOR[request.method],
                  )}
                >
                  {request.method}
                </span>
                {request.name}
              </button>
              <button
                type="button"
                aria-label={`Close ${request.name}`}
                onClick={() => closeRequest(id)}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="New request"
        className="shrink-0 px-2 py-1.5 text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
