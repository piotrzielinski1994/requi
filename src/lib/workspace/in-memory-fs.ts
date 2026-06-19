import type { FileMap } from "@/lib/workspace/disk-format";
import type { ReadResult, WorkspaceFs } from "@/lib/workspace/fs";

export function createInMemoryWorkspaceFs(
  workspaces: Record<string, FileMap>,
): WorkspaceFs {
  return {
    readWorkspace: (rootPath): Promise<ReadResult> => {
      const files = workspaces[rootPath];
      if (!files) {
        return Promise.resolve({
          ok: false,
          error: `No workspace at ${rootPath}`,
        });
      }
      return Promise.resolve({ ok: true, files });
    },
  };
}
