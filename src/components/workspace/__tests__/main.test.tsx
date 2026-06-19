import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { Main } from "@/components/workspace/main";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { createInMemorySettingsStore } from "@/lib/settings/in-memory-store";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { fixtureTree } from "./fixtures";

function renderMain(consoleHidden: boolean) {
  const store = createInMemorySettingsStore({
    ...DEFAULT_SETTINGS,
    consoleHidden,
  });
  return render(
    <SettingsProvider store={store}>
      <WorkspaceProvider
        tree={fixtureTree}
        consoleLines={["[12:00:00] Ready."]}
        initialActiveRequestId="req-token"
      >
        <Main />
      </WorkspaceProvider>
    </SettingsProvider>,
  );
}

describe("Main console visibility", () => {
  // AC-003 — behavior
  it("should render the console body if consoleHidden is false", async () => {
    renderMain(false);

    expect(
      await screen.findByRole("region", { name: /console/i }),
    ).toBeInTheDocument();
  });

  // AC-003 — behavior
  it("should not render the console body if consoleHidden is true", async () => {
    renderMain(true);

    await screen.findByRole("tablist", { name: /request sections/i });
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /console/i }),
      ).not.toBeInTheDocument();
    });
  });
});
