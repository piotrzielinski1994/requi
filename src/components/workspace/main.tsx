import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Content } from "@/components/workspace/content";
import { Console } from "@/components/workspace/console";
import { useSettings } from "@/lib/settings/settings-context";

export function Main() {
  const { settings, saveLayout } = useSettings();

  if (settings.consoleHidden) {
    return (
      <div className="h-full">
        <Content />
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="vertical"
      className="h-full"
      defaultLayout={settings.layouts.main}
      onLayoutChanged={(layout) => saveLayout("main", layout)}
    >
      <ResizablePanel id="content" defaultSize="75%" minSize="30%">
        <Content />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="console" defaultSize="25%" minSize="10%">
        <Console />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
