import type { EffectiveConfig } from "@/lib/workspace/resolve";
import type { Auth, KeyValue, RequestNode } from "@/lib/workspace/model";
import type { HttpRequest } from "@/lib/http/model";

const VAR_TOKEN = /\{\{([^}]+)\}\}/g;

const BODYLESS_METHODS = new Set(["GET", "DELETE"]);

function substitute(
  input: string,
  variables: EffectiveConfig["variables"],
): string {
  return input.replace(VAR_TOKEN, (match, name: string) => {
    const resolved = variables[name.trim()];
    return resolved ? resolved.value : match;
  });
}

function appendParams(
  url: string,
  params: KeyValue[],
): string {
  if (params.length === 0) {
    return url;
  }
  const [base, existing] = url.split(/\?(.*)/s);
  const search = new URLSearchParams(existing ?? "");
  params.forEach(({ key, value }) => search.append(key, value));
  return `${base}?${search.toString()}`;
}

function authHeader(auth: Auth): KeyValue | null {
  if (auth.type === "bearer") {
    return { key: "Authorization", value: `Bearer ${auth.token}` };
  }
  if (auth.type === "basic") {
    return {
      key: "Authorization",
      value: `Basic ${btoa(`${auth.username}:${auth.password}`)}`,
    };
  }
  return null;
}

export function buildHttpRequest(
  node: RequestNode,
  effective: EffectiveConfig,
): HttpRequest {
  const { variables } = effective;

  const headers: KeyValue[] = Object.entries(effective.headers).map(
    ([key, resolved]) => ({ key, value: substitute(resolved.value, variables) }),
  );
  const auth = effective.auth.value;
  const authEntry = authHeader(auth);
  if (authEntry) {
    headers.push(authEntry);
  }

  const params: KeyValue[] = Object.entries(effective.params).map(
    ([key, resolved]) => ({ key, value: substitute(resolved.value, variables) }),
  );
  const url = appendParams(substitute(node.url, variables), params);

  return {
    method: node.method,
    url,
    headers,
    body: BODYLESS_METHODS.has(node.method) ? null : node.body,
    auth,
    timeoutMs: effective.timeoutMs.value,
  };
}
