import type { EffectiveConfig } from "@/lib/workspace/resolve";
import type { Auth, KeyValue, RequestNode } from "@/lib/workspace/model";
import type { HttpRequest } from "@/lib/http/model";
import { interpolate } from "@/lib/http/interpolate";

const BODYLESS_METHODS = new Set(["GET", "DELETE"]);

function authHeader(
  auth: Auth,
  subst: (input: string) => string,
): KeyValue | null {
  if (auth.type === "bearer") {
    return { key: "Authorization", value: `Bearer ${subst(auth.token)}` };
  }
  if (auth.type === "basic") {
    const user = subst(auth.username);
    const pass = subst(auth.password);
    return { key: "Authorization", value: `Basic ${btoa(`${user}:${pass}`)}` };
  }
  return null;
}

function appendParams(url: string, params: KeyValue[]): string {
  if (params.length === 0) {
    return url;
  }
  const [base, existing] = url.split(/\?(.*)/s);
  const search = new URLSearchParams(existing ?? "");
  params.forEach(({ key, value }) => search.append(key, value));
  return `${base}?${search.toString()}`;
}

export function buildHttpRequest(
  node: RequestNode,
  effective: EffectiveConfig,
  processEnv: Record<string, string> = {},
): HttpRequest {
  const vars = Object.fromEntries(
    Object.entries(effective.variables).map(([key, resolved]) => [
      key,
      resolved.value,
    ]),
  );
  const subst = (input: string) => interpolate(input, vars, processEnv);

  const headers: KeyValue[] = Object.entries(effective.headers).map(
    ([key, resolved]) => ({ key, value: subst(resolved.value) }),
  );
  const auth = effective.auth.value;
  const authEntry = authHeader(auth, subst);
  if (authEntry) {
    headers.push(authEntry);
  }

  const params: KeyValue[] = Object.entries(effective.params).map(
    ([key, resolved]) => ({ key, value: subst(resolved.value) }),
  );
  const url = appendParams(subst(node.url), params);

  return {
    method: node.method,
    url,
    headers,
    body: BODYLESS_METHODS.has(node.method) ? null : subst(node.body),
    auth,
    timeoutMs: effective.timeoutMs.value,
  };
}
