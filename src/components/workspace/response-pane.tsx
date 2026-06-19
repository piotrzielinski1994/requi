import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { KeyValueTable } from "@/components/workspace/key-value-table";
import { PANE_TABS_LIST, PANE_TABS_TRIGGER } from "@/components/workspace/pane-tabs";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { RequestResponse } from "@/components/workspace/mock-data";

function ResponseTabs({ response }: { response: RequestResponse }) {
  const { activeResponseTab, setResponseTab } = useWorkspace();

  return (
    <Tabs
      value={activeResponseTab}
      onValueChange={(value) =>
        setResponseTab(value as typeof activeResponseTab)
      }
      className="flex h-full flex-col gap-0"
    >
      <div className="flex h-10.25 items-stretch justify-between gap-2 border-b bg-muted/30">
        <TabsList aria-label="Response sections" className={PANE_TABS_LIST}>
          <TabsTrigger value="response" className={PANE_TABS_TRIGGER}>
            Response
          </TabsTrigger>
          <TabsTrigger value="headers" className={PANE_TABS_TRIGGER}>
            Headers
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-3 px-3 font-mono text-xs">
          <span className="text-green-600 dark:text-green-400">
            {response.status}
          </span>
          <span className="text-muted-foreground">{response.timeMs}ms</span>
          <span className="text-muted-foreground">{response.sizeBytes}B</span>
        </div>
      </div>
      <TabsContent
        value="response"
        className="flex min-h-0 flex-col data-[state=inactive]:hidden"
      >
        <pre className="flex-1 overflow-auto p-3 font-mono text-xs">
          {response.body || "(empty body)"}
        </pre>
        <Input
          aria-label="Filter response"
          readOnly
          placeholder="Filter with a path, e.g. $.data.items[0]"
          className="h-9 rounded-none border-0 border-t bg-background px-3 font-mono text-xs shadow-none focus-visible:border-t-transparent focus-visible:bg-accent focus-visible:ring-[1px] focus-visible:ring-ring/50 focus-visible:ring-inset dark:bg-background"
        />
      </TabsContent>
      <TabsContent value="headers">
        <KeyValueTable rows={response.headers} emptyLabel="No headers" />
      </TabsContent>
    </Tabs>
  );
}

export function ResponsePane() {
  const { activeRequest } = useWorkspace();

  if (!activeRequest?.response) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No response
      </div>
    );
  }

  return <ResponseTabs response={activeRequest.response} />;
}
