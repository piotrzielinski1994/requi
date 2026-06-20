import { invoke } from "@tauri-apps/api/core";
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
  SendResult,
} from "@/lib/http/model";

export function createTauriHttpClient(): HttpClient {
  return {
    send: (req: HttpRequest): Promise<SendResult> =>
      invoke<HttpResponse>("send_http_request", { request: req })
        .then((response): SendResult => ({ ok: true, response }))
        .catch((error): SendResult => ({ ok: false, error: String(error) })),
  };
}
