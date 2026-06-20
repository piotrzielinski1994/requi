export type FilterResult = { ok: true; text: string } | { ok: false };

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const SEGMENT = /\.([^.[\]]+)|\[(\d+)\]/g;

function parseSegments(path: string): string[] | null {
  const body = path.startsWith("$") ? path.slice(1) : path;
  const segments: string[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(SEGMENT)) {
    if (match.index !== lastIndex) {
      return null;
    }
    segments.push(match[1] ?? match[2]);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex !== body.length) {
    return null;
  }
  return segments;
}

function navigate(value: JsonValue, segments: string[]): JsonValue | undefined {
  return segments.reduce<JsonValue | undefined>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }
    if (/^\d+$/.test(segment)) {
      if (!Array.isArray(current)) {
        return undefined;
      }
      return current[Number(segment)];
    }
    if (Array.isArray(current) || typeof current !== "object") {
      return undefined;
    }
    return current[segment];
  }, value);
}

function format(value: JsonValue): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value);
}

export function filterJson(body: string, path: string): FilterResult {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "$") {
    return body.trim() === "" ? { ok: false } : { ok: true, text: body };
  }

  let parsed: JsonValue;
  try {
    parsed = JSON.parse(body) as JsonValue;
  } catch {
    return { ok: false };
  }

  const segments = parseSegments(trimmed);
  if (segments === null) {
    return { ok: false };
  }

  const matched = navigate(parsed, segments);
  if (matched === undefined) {
    return { ok: false };
  }
  return { ok: true, text: format(matched) };
}
