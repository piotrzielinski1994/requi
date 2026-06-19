import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { WorkspaceLoader } from "@/components/workspace/workspace-loader";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { createTauriSettingsStore } from "@/lib/settings/tauri-store";
import { createTauriWorkspaceFs } from "@/lib/workspace/tauri-fs";
import { rootRoute } from "@/routes/__root";

function HomePage() {
  const [settingsStore] = useState(createTauriSettingsStore);
  const [workspaceFs] = useState(createTauriWorkspaceFs);

  return (
    <SettingsProvider store={settingsStore}>
      <WorkspaceLoader fs={workspaceFs} />
    </SettingsProvider>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
