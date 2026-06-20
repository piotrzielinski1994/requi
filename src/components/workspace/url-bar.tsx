import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { METHOD_COLOR } from "@/components/workspace/method-color";
import { useWorkspace } from "@/components/workspace/workspace-context";
import {
  resolveTokenPreview,
  type TokenPreview,
} from "@/components/workspace/url-token";
import type { EffectiveConfig } from "@/lib/workspace/resolve";
import type { HttpMethod } from "@/components/workspace/mock-data";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const URL_TOKEN = /(\{\{[^}]+\}\}|:[A-Za-z_][A-Za-z0-9_]*)/g;

function TokenValueEditor({ preview }: { preview: TokenPreview }) {
  const { setTokenValue } = useWorkspace();
  const { show } = useToast();
  const [draft, setDraft] = useState(preview.rawValue);

  const commit = () => {
    if (draft !== preview.rawValue) {
      setTokenValue(preview.target, draft);
    }
  };

  return (
    <div className="flex items-stretch">
      <Input
        aria-label="Value"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="h-9 flex-1 rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0"
      />
      <button
        type="button"
        aria-label="Copy value"
        onClick={() => {
          navigator.clipboard?.writeText(draft);
          show("Copied to clipboard");
        }}
        className="flex shrink-0 items-center border-l px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

function VarTokenChip({
  token,
  name,
  effective,
  processEnv,
  environment,
}: {
  token: string;
  name: string;
  effective: EffectiveConfig | null;
  processEnv: Record<string, string>;
  environment: string | null;
}) {
  const preview = effective
    ? resolveTokenPreview(name, effective, processEnv, environment ?? undefined)
    : null;
  const colorClass = !preview
    ? "text-red-500 dark:text-red-400"
    : preview.kind === "dotenv"
      ? "text-amber-500 dark:text-amber-400"
      : preview.kind === "environment"
        ? "text-sky-600 dark:text-sky-400"
        : "text-emerald-500 dark:text-emerald-400";

  return (
    <HoverCard openDelay={80} closeDelay={40}>
      <HoverCardTrigger asChild>
        <span className={cn("pointer-events-auto cursor-default", colorClass)}>
          {token}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 overflow-hidden p-0">
        {preview ? (
          <TokenValueEditor key={preview.rawValue} preview={preview} />
        ) : (
          <span className="block p-3 font-mono text-xs text-muted-foreground">
            unresolved
          </span>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function UrlHighlight({
  url,
  effective,
  processEnv,
  environment,
}: {
  url: string;
  effective: EffectiveConfig | null;
  processEnv: Record<string, string>;
  environment: string | null;
}) {
  const parts = url.split(URL_TOKEN);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center truncate px-3 font-mono text-xs whitespace-pre">
      {parts.map((part, index) => {
        if (part.startsWith("{{")) {
          return (
            <VarTokenChip
              key={index}
              token={part}
              name={part.slice(2, -2).trim()}
              effective={effective}
              processEnv={processEnv}
              environment={environment}
            />
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
  effective,
  processEnv,
  environment,
  onChange,
  onSend,
}: {
  url: string;
  effective: EffectiveConfig | null;
  processEnv: Record<string, string>;
  environment: string | null;
  onChange: (url: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="relative flex-1">
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
      <UrlHighlight
        url={url}
        effective={effective}
        processEnv={processEnv}
        environment={environment}
      />
    </div>
  );
}

export function UrlBar() {
  const {
    activeRequest,
    responseState,
    effectiveConfig,
    processEnv,
    activeEnvironment,
    setRequestUrl,
    setRequestMethod,
    sendRequest,
  } = useWorkspace();

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
        effective={effectiveConfig}
        processEnv={processEnv}
        environment={activeEnvironment}
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
