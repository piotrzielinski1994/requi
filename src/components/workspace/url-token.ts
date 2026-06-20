import type { EffectiveConfig } from "@/lib/workspace/resolve";
import { interpolate } from "@/lib/http/interpolate";

export type TokenKind = "variable" | "environment" | "dotenv";

export type TokenTarget =
  | { kind: "variable"; scopeId: string; name: string }
  | { kind: "environment"; scopeId: string; env: string; name: string }
  | { kind: "dotenv"; key: string };

export type TokenPreview = {
  value: string;
  rawValue: string;
  source: string;
  kind: TokenKind;
  target: TokenTarget;
};

const PROCESS_ENV_PREFIX = "process.env.";

function varMap(effective: EffectiveConfig): Record<string, string> {
  return Object.fromEntries(
    Object.entries(effective.variables).map(([key, resolved]) => [
      key,
      resolved.value,
    ]),
  );
}

export function resolveTokenPreview(
  name: string,
  effective: EffectiveConfig,
  processEnv: Record<string, string>,
  environment?: string,
): TokenPreview | null {
  if (name.startsWith(PROCESS_ENV_PREFIX)) {
    const key = name.slice(PROCESS_ENV_PREFIX.length);
    const raw = processEnv[key];
    return raw === undefined
      ? null
      : {
          value: raw,
          rawValue: raw,
          source: ".env",
          kind: "dotenv",
          target: { kind: "dotenv", key },
        };
  }
  const resolved = effective.variables[name];
  if (!resolved) {
    return null;
  }
  const isEnv = resolved.origin === "environment";
  // Env-sourced provenance encodes scopeId as `${scopeId}:${env}`; strip the env suffix.
  const scopeId =
    isEnv && environment
      ? resolved.from.scopeId.slice(0, -(environment.length + 1))
      : resolved.from.scopeId;
  return {
    value: interpolate(resolved.value, varMap(effective), processEnv),
    rawValue: resolved.value,
    source: resolved.from.scopeName,
    kind: isEnv ? "environment" : "variable",
    target:
      isEnv && environment
        ? { kind: "environment", scopeId, env: environment, name }
        : { kind: "variable", scopeId, name },
  };
}
