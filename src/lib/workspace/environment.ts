import type { TreeNode } from "@/lib/workspace/model";

export type ProcessEnv = Record<string, string>;

export function listEnvironmentNames(tree: TreeNode[]): string[] {
  const names = new Set<string>();
  const visit = (node: TreeNode) => {
    Object.keys(node.config.environments ?? {}).forEach((name) =>
      names.add(name),
    );
    if (node.kind === "folder") {
      node.children.forEach(visit);
    }
  };
  tree.forEach(visit);
  return [...names].sort();
}

export function setDotenvValue(
  raw: string,
  key: string,
  value: string,
): string {
  const lines = raw === "" ? [] : raw.split("\n");
  let replaced = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      return line;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1 || trimmed.slice(0, eq).trim() !== key) {
      return line;
    }
    replaced = true;
    return `${key}=${value}`;
  });
  if (!replaced) {
    next.push(`${key}=${value}`);
  }
  return next.join("\n");
}

export function parseDotenv(raw: string): ProcessEnv {
  return raw.split("\n").reduce<ProcessEnv>((acc, line) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      return acc;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      return acc;
    }
    const key = trimmed.slice(0, eq).trim();
    return { ...acc, [key]: trimmed.slice(eq + 1).trim() };
  }, {});
}
