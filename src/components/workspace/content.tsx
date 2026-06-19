import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ContentHeader } from "@/components/workspace/content-header";
import { UrlBar } from "@/components/workspace/url-bar";
import { RequestPane } from "@/components/workspace/request-pane";
import { ResponsePane } from "@/components/workspace/response-pane";
import { useSettings } from "@/lib/settings/settings-context";

export function Content() {
  const { settings, saveLayout } = useSettings();

  return (
    <div className="flex h-full flex-col">
      <ContentHeader />
      <UrlBar />
      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1"
        defaultLayout={settings.layouts.content}
        onLayoutChanged={(layout) => saveLayout("content", layout)}
      >
        <ResizablePanel id="request" defaultSize="50%" minSize="20%">
          <RequestPane />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="response" defaultSize="50%" minSize="20%">
          <ResponsePane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
