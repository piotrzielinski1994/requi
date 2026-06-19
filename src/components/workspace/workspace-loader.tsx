import { useEffect, useState } from "react";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useSettings } from "@/lib/settings/settings-context";
import { deserialize } from "@/lib/workspace/disk-format";
import type { WorkspaceFs } from "@/lib/workspace/fs";
import type { TreeNode } from "@/lib/workspace/model";

type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "loaded"; tree: TreeNode[]; consoleLines: string[] };

function EmptyState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-medium">No workspace</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Set "workspacePath" in settings.json to an exported workspace folder.
      </p>
    </div>
  );
}

export function WorkspaceLoader({ fs }: { fs: WorkspaceFs }) {
  const { settings } = useSettings();
  const workspacePath = settings.workspacePath;
  const [state, setState] = useState<LoadState>(
    workspacePath ? { status: "loading" } : { status: "empty" },
  );

  useEffect(() => {
    if (!workspacePath) {
      return;
    }
    let isMounted = true;
    fs.readWorkspace(workspacePath).then((read) => {
      if (!isMounted) {
        return;
      }
      if (!read.ok) {
        setState({ status: "empty" });
        return;
      }
      const parsed = deserialize(read.files);
      if (!parsed.ok) {
        setState({ status: "empty" });
        return;
      }
      const consoleLines = parsed.skipped.map(
        (path) => `[workspace] skipped malformed file: ${path}`,
      );
      setState({ status: "loaded", tree: parsed.tree, consoleLines });
    });
    return () => {
      isMounted = false;
    };
  }, [fs, workspacePath]);

  if (state.status === "loading") {
    return null;
  }

  if (state.status === "empty") {
    return <EmptyState />;
  }

  return (
    <WorkspaceProvider tree={state.tree} consoleLines={state.consoleLines}>
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}
