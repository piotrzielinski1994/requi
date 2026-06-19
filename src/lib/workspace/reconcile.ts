import type { FileMap } from "@/lib/workspace/disk-format";

const MANAGED_FILE =
  /(?:^|\/)folder\.json$|\.req\.json$|^requi\.workspace\.json$/;

export type ReconcilePlan = { write: FileMap; remove: string[] };

export function planReconcile(current: FileMap, next: FileMap): ReconcilePlan {
  const write: FileMap = {};
  for (const [path, content] of Object.entries(next)) {
    if (current[path] !== content) {
      write[path] = content;
    }
  }
  const remove = Object.keys(current).filter(
    (path) => !(path in next) && MANAGED_FILE.test(path),
  );
  return { write, remove };
}
