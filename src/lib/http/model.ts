import type {
  Auth,
  HttpMethod,
  KeyValue,
  RequestResponse,
} from "@/lib/workspace/model";

export type HttpRequest = {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: string | null;
  auth: Auth;
  timeoutMs: number;
};

export type HttpResponse = RequestResponse;

export type SendResult =
  | { ok: true; response: HttpResponse }
  | { ok: false; error: string };

export type HttpClient = {
  send: (req: HttpRequest) => Promise<SendResult>;
};

export type ResponseState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; response: HttpResponse }
  | { status: "error"; message: string };
