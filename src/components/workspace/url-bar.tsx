import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { METHOD_COLOR } from "@/components/workspace/method-color";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { HttpMethod } from "@/components/workspace/mock-data";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const URL_TOKEN = /(\{\{[^}]+\}\}|:[A-Za-z_][A-Za-z0-9_]*)/g;

function UrlHighlight({ url }: { url: string }) {
  const parts = url.split(URL_TOKEN);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center truncate px-3 font-mono text-xs whitespace-pre"
    >
      {parts.map((part, index) => {
        if (part.startsWith("{{")) {
          return (
            <span key={index} className="text-amber-500 dark:text-amber-400">
              {part}
            </span>
          );
        }
        if (part.startsWith(":")) {
          return (
            <span key={index} className="text-sky-600 dark:text-sky-400">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}

function UrlField({
  url,
  onChange,
  onSend,
}: {
  url: string;
  onChange: (url: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="relative flex-1">
      <UrlHighlight url={url} />
      <input
        aria-label="URL"
        value={url}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSend();
          }
        }}
        spellCheck={false}
        autoComplete="off"
        className="absolute inset-0 h-full w-full bg-transparent px-3 font-mono text-xs whitespace-pre text-transparent caret-foreground outline-none"
      />
    </div>
  );
}

export function UrlBar() {
  const { activeRequest, responseState, setRequestUrl, setRequestMethod, sendRequest } =
    useWorkspace();

  if (!activeRequest) {
    return (
      <div
        role="group"
        aria-label="URL bar"
        className="flex h-10.25 items-center border-b bg-muted/30 px-3 text-sm text-muted-foreground"
      >
        No request selected
      </div>
    );
  }

  const isSending = responseState(activeRequest.id).status === "sending";

  return (
    <div
      role="group"
      aria-label="URL bar"
      className="flex h-10.25 items-stretch border-b bg-muted/30"
    >
      <Select
        value={activeRequest.method}
        onValueChange={(method) =>
          setRequestMethod(activeRequest.id, method as HttpMethod)
        }
      >
        <SelectTrigger
          aria-label="Method"
          className={cn(
            "h-full! w-fit rounded-none border-0 border-r border-r-border bg-transparent font-mono text-xs font-bold shadow-none focus-visible:ring-0 dark:bg-transparent",
            METHOD_COLOR[activeRequest.method],
          )}
        >
          {activeRequest.method}
        </SelectTrigger>
        <SelectContent position="popper">
          {METHODS.map((method) => (
            <SelectItem key={method} value={method}>
              {method}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <UrlField
        url={activeRequest.url}
        onChange={(url) => setRequestUrl(activeRequest.id, url)}
        onSend={() => sendRequest(activeRequest.id)}
      />
      <Button
        type="button"
        disabled={isSending}
        onClick={() => sendRequest(activeRequest.id)}
        className="h-full rounded-none border-0 border-l border-l-border"
      >
        Send
      </Button>
    </div>
  );
}
