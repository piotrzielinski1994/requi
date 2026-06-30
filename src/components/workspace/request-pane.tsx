import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PANE_TABS_LIST,
  PANE_TABS_TRIGGER,
} from "@/components/workspace/pane-tabs";
import { BodyPanel } from "@/components/workspace/body-panel";
import { RequestSettingsForm } from "@/components/workspace/config-editor";
import {
  AuthPanel,
  HeadersPanel,
  ParamsPanel,
  ScriptPanel,
  VarsPanel,
} from "@/components/workspace/config-panels";
import { PathParamsPanel } from "@/components/workspace/path-params-panel";
import type { TokenHighlightContext } from "@/components/workspace/editable-key-value-table";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { RequestNode } from "@/lib/workspace/model";

// The Params tab nests a Path/Query sub-bar. Query edits the request's own
// `config.params` AND bidirectionally mirrors the URL `?query` (via
// setRequestQueryParams); Path is the request-only path params. Query is the default
// so the tab keeps behaving as the single Params tab did.
function ParamsSubTabs({
  request,
  highlight,
}: {
  request: RequestNode;
  highlight: TokenHighlightContext;
}) {
  const { setRequestQueryParams } = useWorkspace();
  const [subTab, setSubTab] = useState<"path" | "query">("query");
  return (
    <Tabs
      value={subTab}
      onValueChange={(value) => setSubTab(value as typeof subTab)}
      className="flex h-full flex-col gap-0"
    >
      <div className="flex h-10.25 items-stretch overflow-x-auto border-b bg-muted/30">
        <TabsList aria-label="Param sections" className={PANE_TABS_LIST}>
          <TabsTrigger value="path" className={PANE_TABS_TRIGGER}>
            Path
          </TabsTrigger>
          <TabsTrigger value="query" className={PANE_TABS_TRIGGER}>
            Query
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="path">
        <PathParamsPanel request={request} highlight={highlight} />
      </TabsContent>
      <TabsContent value="query">
        <ParamsPanel
          config={request.config}
          onChange={(config) =>
            setRequestQueryParams(request.id, config.params ?? [])
          }
          highlight={highlight}
        />
      </TabsContent>
    </Tabs>
  );
}

function RequestTabs({ request }: { request: RequestNode }) {
  const {
    activeRequestTab,
    setRequestTab,
    effectiveConfig,
    processEnv,
    activeEnvironment,
    setRequestConfig,
  } = useWorkspace();
  const highlight = {
    effective: effectiveConfig,
    processEnv,
    environment: activeEnvironment,
    ownScopeId: request.id,
  };
  const onConfigChange = (config: RequestNode["config"]) =>
    setRequestConfig(request.id, config);

  return (
    <Tabs
      value={activeRequestTab}
      onValueChange={(value) => setRequestTab(value as typeof activeRequestTab)}
      className="flex h-full flex-col gap-0"
    >
      <div className="flex h-10.25 items-stretch overflow-x-auto border-b bg-muted/30">
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
          <TabsTrigger value="settings" className={PANE_TABS_TRIGGER}>
            Settings
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="vars">
        <VarsPanel
          config={request.config}
          onChange={onConfigChange}
          highlight={highlight}
        />
      </TabsContent>
      <TabsContent value="auth">
        <AuthPanel
          config={request.config}
          onChange={onConfigChange}
          highlight={highlight}
        />
      </TabsContent>
      <TabsContent value="headers">
        <HeadersPanel
          config={request.config}
          onChange={onConfigChange}
          highlight={highlight}
        />
      </TabsContent>
      <TabsContent value="params" className="min-h-0 flex-1">
        <ParamsSubTabs request={request} highlight={highlight} />
      </TabsContent>
      <TabsContent value="body" className="min-h-0 flex-1">
        <BodyPanel key={request.id} request={request} />
      </TabsContent>
      <TabsContent value="script">
        <ScriptPanel config={request.config} onChange={onConfigChange} />
      </TabsContent>
      <TabsContent value="settings" className="min-h-0 flex-1">
        <RequestSettingsForm key={request.id} request={request} />
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
