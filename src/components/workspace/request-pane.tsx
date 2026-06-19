import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PANE_TABS_LIST, PANE_TABS_TRIGGER } from "@/components/workspace/pane-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { KeyValueTable } from "@/components/workspace/key-value-table";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { Auth, RequestNode } from "@/components/workspace/mock-data";

const AUTH_TYPE_LABELS: Record<Auth["type"], string> = {
  none: "No Auth",
  bearer: "Bearer Token",
  basic: "Basic Auth",
};

function AuthFields({ auth }: { auth: Auth }) {
  if (auth.type === "none") {
    return (
      <p className="text-sm text-muted-foreground">No authentication</p>
    );
  }

  if (auth.type === "bearer") {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor="auth-token" className="text-xs text-muted-foreground">
          Token
        </label>
        <Input id="auth-token" readOnly value={auth.token} className="font-mono" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="auth-username" className="text-xs text-muted-foreground">
          Username
        </label>
        <Input id="auth-username" readOnly value={auth.username} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="auth-password" className="text-xs text-muted-foreground">
          Password
        </label>
        <PasswordField value={auth.password} />
      </div>
    </div>
  );
}

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

function AuthPanel({ auth }: { auth: Auth }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Type</label>
        <Select value={auth.type}>
          <SelectTrigger aria-label="Auth type" className="w-48 text-xs">
            {AUTH_TYPE_LABELS[auth.type]}
          </SelectTrigger>
          <SelectContent position="popper">
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

function RequestTabs({ request }: { request: RequestNode }) {
  const { activeRequestTab, setRequestTab } = useWorkspace();

  return (
    <Tabs
      value={activeRequestTab}
      onValueChange={(value) =>
        setRequestTab(value as typeof activeRequestTab)
      }
      className="flex h-full flex-col gap-0"
    >
      <div className="flex h-10.25 items-stretch border-b bg-muted/30">
        <TabsList aria-label="Request sections" className={PANE_TABS_LIST}>
          <TabsTrigger value="auth" className={PANE_TABS_TRIGGER}>
            Auth
          </TabsTrigger>
          <TabsTrigger value="headers" className={PANE_TABS_TRIGGER}>
            Headers
          </TabsTrigger>
          <TabsTrigger value="params" className={PANE_TABS_TRIGGER}>
            Params
          </TabsTrigger>
          <TabsTrigger value="body" className={PANE_TABS_TRIGGER}>
            Body
          </TabsTrigger>
          <TabsTrigger value="script" className={PANE_TABS_TRIGGER}>
            Script
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="auth">
        <AuthPanel auth={request.auth} />
      </TabsContent>
      <TabsContent value="headers">
        <KeyValueTable rows={request.headers} emptyLabel="No headers" />
      </TabsContent>
      <TabsContent value="params">
        <KeyValueTable rows={request.params} emptyLabel="No query params" />
      </TabsContent>
      <TabsContent value="body">
        <pre className="p-3 font-mono text-xs text-muted-foreground">
          {request.body || "No body"}
        </pre>
      </TabsContent>
      <TabsContent value="script">
        <pre className="p-3 font-mono text-xs text-muted-foreground">
          {request.scripts.pre || "// no pre-request script"}
        </pre>
      </TabsContent>
    </Tabs>
  );
}

export function RequestPane() {
  const { activeRequest } = useWorkspace();

  if (!activeRequest) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No request selected
      </div>
    );
  }

  return <RequestTabs request={activeRequest} />;
}
