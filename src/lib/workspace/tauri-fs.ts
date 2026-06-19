import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import type { FileMap } from "@/lib/workspace/disk-format";
import type { ReadResult, WorkspaceFs } from "@/lib/workspace/fs";

const MANAGED_FILE =
  /(?:^|\/)folder\.json$|\.req\.json$|^requi\.workspace\.json$/;

async function collect(
  absDir: string,
  relPrefix: string,
  files: FileMap,
): Promise<void> {
  const entries = await readDir(absDir);
  for (const entry of entries) {
    const relPath = `${relPrefix}${entry.name}`;
    const absPath = `${absDir}/${entry.name}`;
    if (entry.isDirectory) {
      await collect(absPath, `${relPath}/`, files);
      continue;
    }
    if (entry.isFile && MANAGED_FILE.test(relPath)) {
      files[relPath] = await readTextFile(absPath);
    }
  }
}

export function createTauriWorkspaceFs(): WorkspaceFs {
  return {
    readWorkspace: async (rootPath): Promise<ReadResult> => {
      const files: FileMap = {};
      try {
        await collect(rootPath, "", files);
        return { ok: true, files };
      } catch (error) {
        return { ok: false, error: `Failed to read workspace: ${error}` };
      }
    },
  };
}
