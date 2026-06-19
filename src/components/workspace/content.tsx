import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ContentHeader } from "@/components/workspace/content-header";
import { UrlBar } from "@/components/workspace/url-bar";
import { RequestPane } from "@/components/workspace/request-pane";
import { ResponsePane } from "@/components/workspace/response-pane";

export function Content() {
  return (
    <div className="flex h-full flex-col">
      <ContentHeader />
      <UrlBar />
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize="50%" minSize="20%">
          <RequestPane />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="50%" minSize="20%">
          <ResponsePane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
