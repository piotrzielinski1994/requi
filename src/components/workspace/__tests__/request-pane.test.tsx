import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { RequestPane } from "@/components/workspace/request-pane";
import { fixtureTree } from "./fixtures";

describe("RequestPane", () => {
  // AC-009, TC-004 — behavior
  it("should show the params panel by default and the headers panel after clicking Headers", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-token"
      >
        <RequestPane />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    expect(within(tablist).getByRole("tab", { name: "Auth" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Headers" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Params" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Body" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Script" })).toBeInTheDocument();

    // Params panel visible by default: shows the active request's params.
    expect(screen.getByText("grant_type")).toBeInTheDocument();
    expect(screen.getByText("client_credentials")).toBeInTheDocument();

    await user.click(within(tablist).getByRole("tab", { name: "Headers" }));

    expect(screen.getByText("Content-Type")).toBeInTheDocument();
    expect(
      screen.getByText("application/x-www-form-urlencoded"),
    ).toBeInTheDocument();
  });

  // AC-011 — behavior
  it("should render a token field when the active request auth is bearer", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={["folder-auth", "folder-oauth"]}
        initialActiveRequestId="req-token"
      >
        <RequestPane />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Auth" }));

    const tokenField = screen.getByRole("textbox", { name: /token/i });
    expect(tokenField).toHaveValue("tok-abc-123");
  });

  // AC-011 — behavior
  it("should render username and password fields when the active request auth is basic", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={[]}
        initialActiveRequestId="req-profile"
      >
        <RequestPane />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Auth" }));

    expect(screen.getByRole("textbox", { name: /username/i })).toHaveValue("admin");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue(
      "s3cret",
    );
  });

  // AC-011 — behavior
  it("should reveal the password when the show-password toggle is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={[]}
        initialActiveRequestId="req-profile"
      >
        <RequestPane />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Auth" }));

    const password = screen.getByLabelText("Password", { exact: true });
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));

    expect(password).toHaveAttribute("type", "text");
  });

  // AC-011 — behavior
  it("should render a no-authentication message when the active request auth is none", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider
        tree={fixtureTree}
        initialExpandedIds={[]}
        initialActiveRequestId="req-session"
      >
        <RequestPane />
      </WorkspaceProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Auth" }));

    expect(screen.getByText(/no authentication/i)).toBeInTheDocument();
  });
});
