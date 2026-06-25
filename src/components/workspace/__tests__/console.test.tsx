import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { Console } from "@/components/workspace/console";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { createInMemorySettingsStore } from "@/lib/settings/in-memory-store";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { fixtureTree } from "./fixtures";

function stubMatchMedia(matches = false) {
  window.matchMedia = ((query: string) => {
    void query;
    return {
      matches,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    };
  }) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  // @ts-expect-error - drop the stub between tests.
  delete window.matchMedia;
});

describe("Console", () => {
  // AC-012 — behavior
  it("should render each console log line", () => {
    const consoleLines = [
      "[12:00:00] Ready.",
      "[12:00:01] Loaded mock collection.",
      "[12:00:02] No active request.",
    ];

    render(
      <WorkspaceProvider
        tree={fixtureTree}
        consoleLines={consoleLines}
        initialExpandedIds={[]}
      >
        <Console />
      </WorkspaceProvider>,
    );

    // Lines render as token-colored spans (numbers/strings get their own span),
    // so a line is split across nodes - assert via the list items' textContent.
    const region = screen.getByRole("region", { name: /console/i });
    const rendered = within(region)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    consoleLines.forEach((line) => {
      expect(rendered).toContain(line);
    });
  });

  // AC-011 — behavior: a tokenized console value (e.g. a bare number) is colored
  // with the ACTIVE editor scheme's number color, not a hardcoded hex - so it
  // follows the theme / honors a custom editor color.
  it("should color a tokenized number with the active editor number color", async () => {
    stubMatchMedia(false);
    const NUMBER = "oklch(0.321 0.123 99)";
    const store = createInMemorySettingsStore({
      ...DEFAULT_SETTINGS,
      theme: {
        mode: "light",
        colors: {
          light: { tokens: {}, editor: { number: NUMBER } },
          dark: { tokens: {}, editor: {} },
        },
      },
    });

    render(
      <SettingsProvider store={store}>
        <ThemeProvider>
          <WorkspaceProvider
            tree={fixtureTree}
            consoleLines={["count 42"]}
            initialExpandedIds={[]}
          >
            <Console />
          </WorkspaceProvider>
        </ThemeProvider>
      </SettingsProvider>,
    );

    const numberSpan = await screen.findByText("42");
    expect(numberSpan).toHaveStyle({ color: NUMBER });
  });
});
