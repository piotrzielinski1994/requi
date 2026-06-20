import type { FileMap } from "@/lib/workspace/disk-format";
import type { ReadResult, WorkspaceFs, WriteResult } from "@/lib/workspace/fs";

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
    writeWorkspace: (rootPath, files): Promise<WriteResult> => {
      workspaces[rootPath] = files;
      return Promise.resolve({ ok: true });
    },
    writeEnv: (rootPath, content): Promise<WriteResult> => {
      workspaces[rootPath] = { ...(workspaces[rootPath] ?? {}), ".env": content };
      return Promise.resolve({ ok: true });
    },
  };
}
