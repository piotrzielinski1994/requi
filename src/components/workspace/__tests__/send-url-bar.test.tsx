import { describe, it, expect } from "vitest";
import { render, screen, within, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/workspace/workspace-context";
import { UrlBar } from "@/components/workspace/url-bar";
import { fixtureTree } from "./fixtures";
import { createFakeHttpClient, type FakeHttpClient } from "./fake-http-client";

function ActiveUrlReadout() {
  const { activeRequest } = useWorkspace();
  return <span data-testid="active-url">{`[${activeRequest?.url ?? "none"}]`}</span>;
}

function renderBar(client: FakeHttpClient, initialActiveRequestId = "req-token") {
  return render(
    <WorkspaceProvider
      tree={fixtureTree}
      initialExpandedIds={["folder-auth", "folder-oauth"]}
      initialActiveRequestId={initialActiveRequestId}
      httpClient={client}
    >
      <UrlBar />
      <ActiveUrlReadout />
    </WorkspaceProvider>,
  );
}

describe("UrlBar editable url", () => {
  // AC-001 — behavior: URL is an editable textbox.
  it("should expose the URL as an editable text input seeded with the active url", () => {
    renderBar(createFakeHttpClient());

    const bar = screen.getByRole("group", { name: /url bar/i });
    const urlBox = within(bar).getByRole("textbox", { name: /url/i });

    expect(urlBox).toHaveValue("{{baseUrl}}/oauth/token");
    expect(urlBox).not.toHaveAttribute("aria-readonly", "true");
  });

  // AC-001, TC-003 — behavior: typing updates the active request url.
  it("should update the active request url as the user types", async () => {
    const user = userEvent.setup();
    renderBar(createFakeHttpClient());

    const bar = screen.getByRole("group", { name: /url bar/i });
    const urlBox = within(bar).getByRole("textbox", { name: /url/i });

    await user.clear(urlBox);
    await user.type(urlBox, "https://typed.example.com/x");

    expect(screen.getByTestId("active-url")).toHaveTextContent(
      "[https://typed.example.com/x]",
    );
  });
});

describe("UrlBar Send button", () => {
  // AC-003 — side-effect-contract: Send triggers the http client.
  it("should send the active request when Send is clicked", async () => {
    const user = userEvent.setup();
    const client = createFakeHttpClient();
    renderBar(client);

    const bar = screen.getByRole("group", { name: /url bar/i });
    await user.click(within(bar).getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(client.callCount).toBe(1);
    });
  });

  // AC-005 — behavior: Send is disabled while the active request is sending.
  it("should disable the Send button while the request is in flight", async () => {
    const user = userEvent.setup();
    const client = createFakeHttpClient(undefined, { manual: true });
    renderBar(client);

    const bar = screen.getByRole("group", { name: /url bar/i });
    const send = within(bar).getByRole("button", { name: /send/i });

    expect(send).toBeEnabled();

    await user.click(send);

    expect(send).toBeDisabled();

    await act(async () => {
      client.resolveNext();
    });

    await waitFor(() => {
      expect(send).toBeEnabled();
    });
  });
});
