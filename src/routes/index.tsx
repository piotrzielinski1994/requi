import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { WorkspaceLoader } from "@/components/workspace/workspace-loader";
import { createTauriWorkspaceFs } from "@/lib/workspace/tauri-fs";
import { createTauriFolderPicker } from "@/lib/workspace/folder-picker";
import { createTauriHttpClient } from "@/lib/http/tauri-client";
import { rootRoute } from "@/routes/__root";

function HomePage() {
  const [workspaceFs] = useState(createTauriWorkspaceFs);
  const [picker] = useState(createTauriFolderPicker);
  const [httpClient] = useState(createTauriHttpClient);

  return (
    <WorkspaceLoader fs={workspaceFs} picker={picker} httpClient={httpClient} />
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
