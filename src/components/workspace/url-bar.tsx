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

function UrlDisplay({ url }: { url: string }) {
  const parts = url.split(URL_TOKEN);
  return (
    <div
      role="textbox"
      aria-label="URL"
      aria-readonly="true"
      className="flex flex-1 items-center truncate px-3 font-mono text-xs"
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

export function UrlBar() {
  const { activeRequest } = useWorkspace();

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

  return (
    <div
      role="group"
      aria-label="URL bar"
      className="flex h-10.25 items-stretch border-b bg-muted/30"
    >
      <Select value={activeRequest.method}>
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
      <UrlDisplay url={activeRequest.url} />
      <Button
        type="button"
        className="h-full rounded-none border-0 border-l border-l-border"
      >
        Send
      </Button>
    </div>
  );
}
