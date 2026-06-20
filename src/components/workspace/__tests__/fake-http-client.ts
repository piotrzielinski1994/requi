import type { HttpClient, HttpRequest, SendResult } from "@/lib/http/model";

// Test HttpClient used by context/component tests. Chosen shape:
//
//   createFakeHttpClient(script?, options?) -> HttpClient & {
//     calls: HttpRequest[];           // every request passed to send(), in order
//     readonly callCount: number;     // === calls.length (convenience)
//     resolveNext(): void;            // resolve the oldest still-pending send()
//   }
//
// `script` controls what each send() resolves to:
//   - omitted        -> a default 200 success SendResult
//   - a SendResult   -> every send resolves to that result
//   - a function     -> (req, callIndex) => SendResult, evaluated per call
//
// By default each send() resolves immediately. Pass { manual: true } to make
// send() return a promise that settles only when resolveNext() is called - lets
// a test observe the "sending" state before the result lands. The recorded
// `calls` array is the side-effect contract for "client called once" asserts.

export type FakeScript =
  | SendResult
  | ((req: HttpRequest, callIndex: number) => SendResult);

export type FakeHttpClientOptions = { manual?: boolean };

export type FakeHttpClient = HttpClient & {
  calls: HttpRequest[];
  readonly callCount: number;
  resolveNext: () => void;
};

const DEFAULT_RESULT: SendResult = {
  ok: true,
  response: { status: 200, timeMs: 1, sizeBytes: 0, body: "", headers: [] },
};

export function createFakeHttpClient(
  script: FakeScript = DEFAULT_RESULT,
  options: FakeHttpClientOptions = {},
): FakeHttpClient {
  const calls: HttpRequest[] = [];
  const pending: Array<() => void> = [];

  const resultFor = (req: HttpRequest, index: number): SendResult =>
    typeof script === "function" ? script(req, index) : script;

  return {
    calls,
    get callCount() {
      return calls.length;
    },
    resolveNext: () => {
      const settle = pending.shift();
      settle?.();
    },
    send: (req: HttpRequest): Promise<SendResult> => {
      const index = calls.length;
      calls.push(req);
      const result = resultFor(req, index);
      if (!options.manual) {
        return Promise.resolve(result);
      }
      return new Promise<SendResult>((resolve) => {
        pending.push(() => resolve(result));
      });
    },
  };
}
