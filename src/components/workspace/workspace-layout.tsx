import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "@/components/workspace/sidebar";
import { Main } from "@/components/workspace/main";
import { useSettings } from "@/lib/settings/settings-context";

export function WorkspaceLayout() {
  const { settings, saveLayout } = useSettings();

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full w-full"
      defaultLayout={settings.layouts.workspace}
      onLayoutChanged={(layout) => saveLayout("workspace", layout)}
    >
      <ResizablePanel
        id="sidebar"
        defaultSize="20%"
        minSize="12%"
        maxSize="40%"
      >
        <Sidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="content" defaultSize="80%">
        <Main />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
