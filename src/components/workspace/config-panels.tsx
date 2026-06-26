import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PANE_TABS_LIST,
  PANE_TABS_TRIGGER,
} from "@/components/workspace/pane-tabs";
import {
  EditableKeyValueTable,
  type TokenHighlightContext,
} from "@/components/workspace/editable-key-value-table";
import { ScriptEditor } from "@/components/workspace/script-editor";
import type { ScriptStage } from "@/lib/scripts/model";
import type { Auth, ConfigScope } from "@/lib/workspace/model";

const AUTH_TYPE_LABELS: Record<Auth["type"], string> = {
  inherit: "Inherit",
  none: "No Auth",
  bearer: "Bearer Token",
  basic: "Basic Auth",
};

// Shared grid cell + input styling so the auth fields read like the Params grid.
const AUTH_CELL = "border-r border-b border-border bg-background";
const AUTH_INPUT =
  "h-9 w-full bg-background px-2 font-mono text-xs outline-none placeholder:text-muted-foreground";

// One label-cell + value-cell row inside the auth grid. Commits on blur. A
// `secret` field renders password-masked with a show/hide toggle in its cell.
function AuthRow({
  id,
  label,
  value,
  secret = false,
  mono = false,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  secret?: boolean;
  mono?: boolean;
  onCommit: (value: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;
  return (
    <div className="contents">
      <div className={cn(AUTH_CELL, "flex items-center px-2")}>
        <label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </label>
      </div>
      <div className={cn(AUTH_CELL, "relative")}>
        <input
          id={id}
          type={secret && !isVisible ? "password" : "text"}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onCommit(event.target.value)}
          className={cn(AUTH_INPUT, secret && "pr-9", mono && "font-mono")}
        />
        {secret && (
          <button
            type="button"
            aria-label={isVisible ? "Hide password" : "Show password"}
            aria-pressed={isVisible}
            onClick={() => setIsVisible((visible) => !visible)}
            className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground hover:text-foreground"
          >
            <Icon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function AuthFields({
  auth,
  onChange,
}: {
  auth: Auth;
  onChange: (auth: Auth) => void;
}) {
  if (auth.type === "inherit") {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Inherited from parent folder
      </p>
    );
  }

  if (auth.type === "none") {
    return (
      <p className="p-3 text-sm text-muted-foreground">No authentication</p>
    );
  }

  return (
    <div
      role="grid"
      aria-label="Auth fields"
      className="grid border-t border-l border-border"
      style={{ gridTemplateColumns: "8rem 1fr" }}
    >
      {auth.type === "bearer" ? (
        <AuthRow
          id="auth-token"
          label="Token"
          value={auth.token}
          mono
          onCommit={(token) => onChange({ type: "bearer", token })}
        />
      ) : (
        <>
          <AuthRow
            id="auth-username"
            label="Username"
            value={auth.username}
            onCommit={(username) => onChange({ ...auth, username })}
          />
          <AuthRow
            id="auth-password"
            label="Password"
            value={auth.password}
            secret
            onCommit={(password) => onChange({ ...auth, password })}
          />
        </>
      )}
    </div>
  );
}

// Switching auth type seeds sensible empty fields for the new variant.
export function authForType(type: Auth["type"]): Auth {
  if (type === "bearer") {
    return { type: "bearer", token: "" };
  }
  if (type === "basic") {
    return { type: "basic", username: "", password: "" };
  }
  return { type };
}

export function AuthPanel({
  config,
  onChange,
}: {
  config: ConfigScope;
  onChange: (config: ConfigScope) => void;
}) {
  const auth = config.auth ?? { type: "inherit" };

  const change = (nextAuth: Auth) => onChange({ ...config, auth: nextAuth });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10.25 items-stretch overflow-x-auto border-b bg-muted/30">
        <Select
          value={auth.type}
          onValueChange={(type) => change(authForType(type as Auth["type"]))}
        >
          <SelectTrigger
            aria-label="Auth type"
            className="h-full! w-fit rounded-none border-0 border-r border-r-border bg-transparent text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          >
            {AUTH_TYPE_LABELS[auth.type]}
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="inherit">Inherit</SelectItem>
            <SelectItem value="none">No Auth</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AuthFields auth={auth} onChange={change} />
    </div>
  );
}

export function VarsPanel({
  config,
  onChange,
  highlight,
}: {
  config: ConfigScope;
  onChange: (config: ConfigScope) => void;
  highlight?: TokenHighlightContext;
}) {
  const rows = Object.entries(config.variables ?? {}).map(([key, value]) => ({
    key,
    value,
  }));
  return (
    <EditableKeyValueTable
      rows={rows}
      keyPlaceholder="name"
      highlight={highlight}
      onChange={(next) =>
        onChange({
          ...config,
          variables: Object.fromEntries(next.map((r) => [r.key, r.value])),
        })
      }
    />
  );
}

export function HeadersPanel({
  config,
  onChange,
  highlight,
}: {
  config: ConfigScope;
  onChange: (config: ConfigScope) => void;
  highlight?: TokenHighlightContext;
}) {
  return (
    <EditableKeyValueTable
      rows={config.headers ?? []}
      withToggle
      highlight={highlight}
      onChange={(headers) => onChange({ ...config, headers })}
    />
  );
}

export function ParamsPanel({
  config,
  onChange,
  highlight,
}: {
  config: ConfigScope;
  onChange: (config: ConfigScope) => void;
  highlight?: TokenHighlightContext;
}) {
  return (
    <EditableKeyValueTable
      rows={config.params ?? []}
      withToggle
      highlight={highlight}
      onChange={(params) => onChange({ ...config, params })}
    />
  );
}

export function ScriptPanel({
  config,
  onChange,
}: {
  config: ConfigScope;
  onChange: (config: ConfigScope) => void;
}) {
  const commit = (patch: { pre?: string; post?: string }) =>
    onChange({
      ...config,
      scripts: { ...config.scripts, ...patch },
    });
  return (
    <Tabs defaultValue="pre" className="flex h-full min-h-0 flex-col gap-0">
      <div className="flex h-10.25 items-stretch overflow-x-auto border-b bg-muted/30">
        <TabsList aria-label="Script stage" className={PANE_TABS_LIST}>
          <TabsTrigger value="pre" className={PANE_TABS_TRIGGER}>
            Pre
          </TabsTrigger>
          <TabsTrigger value="post" className={PANE_TABS_TRIGGER}>
            Post
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="pre" className="min-h-0 flex-1">
        <ScriptField
          label="Pre-request"
          stage="pre"
          value={config.scripts?.pre ?? ""}
          onCommit={(pre) => commit({ pre })}
        />
      </TabsContent>
      <TabsContent value="post" className="min-h-0 flex-1">
        <ScriptField
          label="Post-response"
          stage="post"
          value={config.scripts?.post ?? ""}
          onCommit={(post) => commit({ post })}
        />
      </TabsContent>
    </Tabs>
  );
}

function ScriptField({
  label,
  stage,
  value,
  onCommit,
}: {
  label: string;
  stage: ScriptStage;
  value: string;
  onCommit: (value: string) => void;
}) {
  // Controlled: commit each edit straight into the parent draft so Cmd+S saves
  // the latest text even while the editor still has focus (no blur buffering).
  // The draft is in-memory now (persist only on Cmd+S), so per-keystroke commit
  // is cheap and removes the blur/unmount-flush gap that lost edits on save.
  return (
    <div className="h-full p-2">
      <ScriptEditor
        ariaLabel={label}
        stage={stage}
        value={value}
        onChange={onCommit}
      />
    </div>
  );
}
