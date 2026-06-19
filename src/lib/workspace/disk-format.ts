import type {
  ConfigScope,
  FolderNode,
  HttpMethod,
  RequestNode,
  TreeNode,
} from "@/lib/workspace/model";

export type FileMap = Record<string, string>;

export type DeserializeResult =
  | { ok: true; tree: TreeNode[]; skipped: string[] }
  | { ok: false; error: string };

const MANIFEST = "requi.workspace.json";

type ParsedRequest = {
  name?: string;
  method?: HttpMethod;
  url?: string;
  body?: string;
  config?: ConfigScope;
};

type ParsedFolder = { name?: string; config?: ConfigScope };

function tryParse<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  const slug = `${base}-${suffix}`;
  used.add(slug);
  return slug;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function serializeInto(
  files: FileMap,
  nodes: TreeNode[],
  prefix: string,
): void {
  const used = new Set<string>();
  for (const node of sortNodes(nodes)) {
    const slug = uniqueSlug(slugify(node.name), used);
    if (node.kind === "folder") {
      const dir = `${prefix}${slug}`;
      files[`${dir}/folder.json`] = JSON.stringify(
        { name: node.name, config: node.config },
        null,
        2,
      );
      serializeInto(files, node.children, `${dir}/`);
      continue;
    }
    files[`${prefix}${slug}.req.json`] = JSON.stringify(
      {
        name: node.name,
        method: node.method,
        url: node.url,
        body: node.body,
        config: node.config,
      },
      null,
      2,
    );
  }
}

export function serialize(
  tree: TreeNode[],
  workspaceName = "Workspace",
): FileMap {
  const files: FileMap = {
    [MANIFEST]: JSON.stringify(
      { schemaVersion: 1, name: workspaceName },
      null,
      2,
    ),
  };
  serializeInto(files, tree, "");
  return files;
}

function parseRequest(
  files: FileMap,
  path: string,
  prefix: string,
): RequestNode | null {
  const parsed = tryParse<ParsedRequest>(files[path]);
  if (!parsed) {
    return null;
  }
  const slug = path.slice(prefix.length).replace(/\.req\.json$/, "");
  return {
    kind: "request",
    id: path.replace(/\.req\.json$/, ""),
    name: parsed.name ?? slug,
    method: parsed.method ?? "GET",
    url: parsed.url ?? "",
    body: parsed.body ?? "",
    config: parsed.config ?? {},
  };
}

function buildLevel(
  files: FileMap,
  prefix: string,
  skipped: string[],
): TreeNode[] {
  const requestPaths: string[] = [];
  const subdirs = new Set<string>();

  for (const path of Object.keys(files)) {
    if (path === MANIFEST || !path.startsWith(prefix)) {
      continue;
    }
    const rest = path.slice(prefix.length);
    const slashIndex = rest.indexOf("/");
    if (slashIndex === -1) {
      if (rest.endsWith(".req.json")) {
        requestPaths.push(path);
      }
      continue;
    }
    subdirs.add(rest.slice(0, slashIndex));
  }

  const requests = requestPaths.flatMap((path) => {
    const node = parseRequest(files, path, prefix);
    if (!node) {
      skipped.push(path);
      return [];
    }
    return [node];
  });

  const folders = [...subdirs].flatMap<TreeNode>((segment) => {
    const dir = `${prefix}${segment}`;
    const folderJsonPath = `${dir}/folder.json`;
    const raw = files[folderJsonPath];
    const parsed = raw === undefined ? undefined : tryParse<ParsedFolder>(raw);
    if (raw !== undefined && parsed === undefined) {
      skipped.push(folderJsonPath);
      return [];
    }
    const folder: FolderNode = {
      kind: "folder",
      id: dir,
      name: parsed?.name ?? segment,
      config: parsed?.config ?? {},
      children: buildLevel(files, `${dir}/`, skipped),
    };
    return [folder];
  });

  return sortNodes([...requests, ...folders]);
}

export function deserialize(files: FileMap): DeserializeResult {
  if (files[MANIFEST] === undefined) {
    return { ok: false, error: `Not a workspace: missing ${MANIFEST}` };
  }
  const skipped: string[] = [];
  const tree = buildLevel(files, "", skipped);
  return { ok: true, tree, skipped };
}
