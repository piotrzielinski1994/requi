const TOKEN = /\{\{([^}]+)\}\}/g;

const PROCESS_ENV_PREFIX = "process.env.";

function lookup(
  name: string,
  vars: Record<string, string>,
  processEnv: Record<string, string>,
): string | undefined {
  if (name.startsWith(PROCESS_ENV_PREFIX)) {
    return processEnv[name.slice(PROCESS_ENV_PREFIX.length)];
  }
  return vars[name];
}

function resolveToken(
  name: string,
  vars: Record<string, string>,
  processEnv: Record<string, string>,
  visited: Set<string>,
): string {
  const raw = lookup(name, vars, processEnv);
  if (raw === undefined || visited.has(name)) {
    return `{{${name}}}`;
  }
  const next = new Set(visited).add(name);
  return raw.replace(TOKEN, (_match, inner: string) =>
    resolveToken(inner.trim(), vars, processEnv, next),
  );
}

export function interpolate(
  text: string,
  vars: Record<string, string>,
  processEnv: Record<string, string>,
): string {
  return text.replace(TOKEN, (_match, inner: string) =>
    resolveToken(inner.trim(), vars, processEnv, new Set()),
  );
}
