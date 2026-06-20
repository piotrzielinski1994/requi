import type { HttpClient, SendResult } from "@/lib/http/model";

const NOT_WIRED: SendResult = {
  ok: false,
  error: "HTTP is not available in this environment (no Tauri host).",
};

export function createFakeHttpClient(
  result: SendResult = NOT_WIRED,
): HttpClient {
  return {
    send: () => Promise.resolve(result),
  };
}
