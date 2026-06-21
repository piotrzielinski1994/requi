import { invoke } from "@tauri-apps/api/core";
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
  SendResult,
} from "@/lib/http/model";

const CANCEL_SENTINEL = "__cancelled__";

function toSendError(error: unknown): SendResult {
  const message = String(error);
  return { ok: false, error: message, cancelled: message === CANCEL_SENTINEL };
}

export function createTauriHttpClient(): HttpClient {
  return {
    send: (req: HttpRequest): Promise<SendResult> =>
      invoke<HttpResponse>("send_http_request", { request: req })
        .then((response): SendResult => ({ ok: true, response }))
        .catch(toSendError),
    cancel: (requestId: string): Promise<void> =>
      invoke("cancel_http_request", { requestId }).then(() => undefined),
  };
}
