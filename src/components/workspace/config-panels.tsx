import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { KeyValueTable } from "@/components/workspace/key-value-table";
import type { Auth, ConfigScope } from "@/components/workspace/mock-data";

const AUTH_TYPE_LABELS: Record<Auth["type"], string> = {
  inherit: "Inherit",
  none: "No Auth",
  bearer: "Bearer Token",
  basic: "Basic Auth",
};

function PasswordField({ value }: { value: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        id="auth-password"
        type={isVisible ? "text" : "password"}
        readOnly
        value={value}
        className="pr-9"
      />
      <button
        type="button"
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground hover:text-foreground"
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}

function AuthFields({ auth }: { auth: Auth }) {
  if (auth.type === "inherit") {
    return (
      <p className="text-sm text-muted-foreground">
        Inherited from parent folder
      </p>
    );
  }

  if (auth.type === "none") {
    return <p className="text-sm text-muted-foreground">No authentication</p>;
  }

  if (auth.type === "bearer") {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor="auth-token" className="text-xs text-muted-foreground">
          Token
        </label>
        <Input
          id="auth-token"
          readOnly
          value={auth.token}
          className="font-mono"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="auth-username"
          className="text-xs text-muted-foreground"
        >
          Username
        </label>
        <Input id="auth-username" readOnly value={auth.username} />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="auth-password"
          className="text-xs text-muted-foreground"
        >
          Password
        </label>
        <PasswordField value={auth.password} />
      </div>
    </div>
  );
}

export function AuthPanel({ auth }: { auth: Auth }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Type</label>
        <Select value={auth.type}>
          <SelectTrigger aria-label="Auth type" className="w-48 text-xs">
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
      <AuthFields auth={auth} />
    </div>
  );
}

export function VarsPanel({ config }: { config: ConfigScope }) {
  return (
    <KeyValueTable
      rows={Object.entries(config.variables ?? {}).map(([key, value]) => ({
        key,
        value,
      }))}
      emptyLabel="No variables"
    />
  );
}

export function HeadersPanel({ config }: { config: ConfigScope }) {
  return <KeyValueTable rows={config.headers ?? []} emptyLabel="No headers" />;
}

export function ParamsPanel({ config }: { config: ConfigScope }) {
  return (
    <KeyValueTable rows={config.params ?? []} emptyLabel="No query params" />
  );
}

export function ScriptPanel({ config }: { config: ConfigScope }) {
  return (
    <pre className="p-3 font-mono text-xs text-muted-foreground">
      {config.scripts?.pre || "// no pre-request script"}
    </pre>
  );
}
