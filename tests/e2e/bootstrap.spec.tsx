import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";

import { AppProviders } from "@/app/providers";
import { rootRoute } from "@/routes/__root";
import { indexRoute } from "@/routes/index";
import { settingsRoute } from "@/routes/settings";

function renderApp(initialPath = "/") {
  const routeTree = rootRoute.addChildren([indexRoute, settingsRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe("app routing", () => {
  // AC-001, AC-002 — behavior
  it("should render the workspace at the home route on launch", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("tree", { name: /collection/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /console/i }),
    ).toBeInTheDocument();
  });

  // AC-015 — behavior: the bootstrap demo shell is gone
  it("should not render the bootstrap demo nav at the home route", async () => {
    renderApp("/");

    await screen.findByRole("tree", { name: /collection/i });
    expect(screen.queryByRole("link", { name: /^home$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render the settings route when navigated to directly", async () => {
    renderApp("/settings");

    expect(
      await screen.findByText(/configuration lives here/i),
    ).toBeInTheDocument();
  });

  it("should render a not-found view for an unknown route", async () => {
    renderApp("/this-route-does-not-exist");

    expect(await screen.findByText(/404/i)).toBeInTheDocument();
    expect(screen.getByText(/does not exist/i)).toBeInTheDocument();
  });
});
