import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PANE_TABS_LIST,
  PANE_TABS_TRIGGER,
} from "@/components/workspace/pane-tabs";
import { BodyEditor } from "@/components/workspace/body-editor";
import { ConfigEditorForm } from "@/components/workspace/config-editor";
import {
  AuthPanel,
  HeadersPanel,
  ParamsPanel,
  ScriptPanel,
  VarsPanel,
} from "@/components/workspace/config-panels";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { RequestNode } from "@/components/workspace/mock-data";
import type { EffectiveConfig, ResolvedValue } from "@/lib/workspace/resolve";

function EffectiveRow({
  label,
  resolved,
}: {
  label: string;
  resolved: ResolvedValue<string>;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-mono">{resolved.value}</span>
        <span className="text-xs text-muted-foreground">
          ← {resolved.from.scopeName}
        </span>
      </span>
    </div>
  );
}

function EffectiveSection({
  title,
  entries,
}: {
  title: string;
  entries: Record<string, ResolvedValue<string>>;
}) {
  const keys = Object.keys(entries);
  if (keys.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {keys.map((key) => (
        <EffectiveRow key={key} label={key} resolved={entries[key]} />
      ))}
    </div>
  );
}

function EffectivePanel({ effective }: { effective: EffectiveConfig }) {
  const authValue =
    effective.auth.value.type === "bearer"
      ? effective.auth.value.token
      : effective.auth.value.type;

  return (
    <div className="flex flex-col gap-4 p-3 text-sm">
      <EffectiveSection title="Variables" entries={effective.variables} />
      <EffectiveSection title="Headers" entries={effective.headers} />
      <EffectiveSection title="Params" entries={effective.params} />
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide uppercase">Auth</h3>
        <EffectiveRow
          label={effective.auth.value.type}
          resolved={{ value: authValue, from: effective.auth.from }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide uppercase">
          Timeout
        </h3>
        <EffectiveRow
          label="timeoutMs"
          resolved={{
            value: String(effective.timeoutMs.value),
            from: effective.timeoutMs.from,
          }}
        />
      </div>
    </div>
  );
}

function RequestTabs({ request }: { request: RequestNode }) {
  const { activeRequestTab, setRequestTab, setRequestBody, effectiveConfig } =
    useWorkspace();

  return (
    <Tabs
      value={activeRequestTab}
      onValueChange={(value) => setRequestTab(value as typeof activeRequestTab)}
      className="flex h-full flex-col gap-0"
    >
      <div className="flex h-10.25 items-stretch border-b bg-muted/30">
        <TabsList aria-label="Request sections" className={PANE_TABS_LIST}>
          <TabsTrigger value="vars" className={PANE_TABS_TRIGGER}>
            Vars
          </TabsTrigger>
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
          <TabsTrigger value="effective" className={PANE_TABS_TRIGGER}>
            Effective
          </TabsTrigger>
          <TabsTrigger value="settings" className={PANE_TABS_TRIGGER}>
            Settings
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="vars">
        <VarsPanel config={request.config} />
      </TabsContent>
      <TabsContent value="auth">
        <AuthPanel auth={request.config.auth ?? { type: "inherit" }} />
      </TabsContent>
      <TabsContent value="headers">
        <HeadersPanel config={request.config} />
      </TabsContent>
      <TabsContent value="params">
        <ParamsPanel config={request.config} />
      </TabsContent>
      <TabsContent value="body" className="min-h-0 flex-1">
        <BodyEditor
          key={request.id}
          value={request.body}
          onChange={(body) => setRequestBody(request.id, body)}
        />
      </TabsContent>
      <TabsContent value="script">
        <ScriptPanel config={request.config} />
      </TabsContent>
      <TabsContent value="effective">
        {effectiveConfig ? (
          <EffectivePanel effective={effectiveConfig} />
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            No resolved config
          </p>
        )}
      </TabsContent>
      <TabsContent value="settings" className="min-h-0 flex-1">
        <ConfigEditorForm key={request.id} id={request.id} config={request.config} />
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
