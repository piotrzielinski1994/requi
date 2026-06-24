import { useState } from "react";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { createTauriSettingsStore } from "@/lib/settings/tauri-store";
import { createInMemorySettingsStore } from "@/lib/settings/in-memory-store";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { isDevBrowser } from "@/lib/runtime/environment";
import { DEMO_WORKSPACE_PATH } from "@/lib/workspace/demo-seed";
import { ToastProvider } from "@/components/ui/toast";

function createSettingsStore() {
  if (isDevBrowser()) {
    return createInMemorySettingsStore({
      ...DEFAULT_SETTINGS,
      workspacePath: DEMO_WORKSPACE_PATH,
    });
  }
  return createTauriSettingsStore();
}

function RootLayout() {
  const [settingsStore] = useState(createSettingsStore);

  return (
    <SettingsProvider store={settingsStore}>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </SettingsProvider>
  );
}

function NotFound() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">404 - Not found</h1>
      <p className="text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="underline">
        Go home
      </Link>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
