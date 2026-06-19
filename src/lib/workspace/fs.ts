import type { FileMap } from "@/lib/workspace/disk-format";

export type ReadResult =
  | { ok: true; files: FileMap }
  | { ok: false; error: string };

export type WorkspaceFs = {
  readWorkspace: (rootPath: string) => Promise<ReadResult>;
};
