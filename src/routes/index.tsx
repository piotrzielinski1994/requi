import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { createTauriSettingsStore } from "@/lib/settings/tauri-store";
import { rootRoute } from "@/routes/__root";

function HomePage() {
  const [settingsStore] = useState(createTauriSettingsStore);

  return (
    <SettingsProvider store={settingsStore}>
      <WorkspaceProvider
        initialExpandedIds={[
          "f-auth",
          "f-oauth",
          "f-tokens",
          "f-users",
          "f-billing",
        ]}
        initialActiveRequestId="r-token"
      >
        <WorkspaceLayout />
      </WorkspaceProvider>
    </SettingsProvider>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
