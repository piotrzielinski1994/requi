import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/workspace/workspace-context";
import { SidebarTree } from "@/components/workspace/sidebar-tree";
import { UrlBar } from "@/components/workspace/url-bar";
import { ToastProvider } from "@/components/ui/toast";
import { fixtureTree } from "./fixtures";

// A freshly created request auto-names itself from its URL until the user gives
// it a name (rename) or it is saved. An already-named request does NOT.

function AutoNameProbe() {
  const {
    activeRequest,
    activeRequestId,
    newRequest,
    setRequestUrl,
    setActiveRequest,
    commitRename,
    beginRename,
  } = useWorkspace();

  return (
    <div>
      <span data-testid="active-id">{activeRequestId ?? "none"}</span>
      <span data-testid="active-name">{activeRequest?.name ?? "none"}</span>
      <button type="button" onClick={() => newRequest()}>
        new request
      </button>
      <button
        type="button"
        onClick={() => {
          if (activeRequestId !== null) {
            setRequestUrl(activeRequestId, "{{baseUrl}}/widgets/list");
          }
        }}
      >
        type url
      </button>
      <button
        type="button"
        onClick={() => {
          if (activeRequestId !== null) {
            setRequestUrl(activeRequestId, "{{baseUrl}}/changed");
          }
        }}
      >
        type url again
      </button>
      <button
        type="button"
        onClick={() => {
          if (activeRequestId !== null) {
            commitRename(activeRequestId, "My Name");
          }
        }}
      >
        commit rename
      </button>
      <button
        type="button"
        onClick={() => {
          if (activeRequestId !== null) {
            beginRename(activeRequestId);
          }
        }}
      >
        begin rename
      </button>
      <button type="button" onClick={() => setActiveRequest("req-profile")}>
        activate profile
      </button>
      <button
        type="button"
        onClick={() => setRequestUrl("req-profile", "{{baseUrl}}/should-not-rename")}
      >
        edit profile url
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ToastProvider>
      <WorkspaceProvider tree={fixtureTree}>
        <AutoNameProbe />
      </WorkspaceProvider>
    </ToastProvider>,
  );
}

describe("WorkspaceProvider request auto-name", () => {
  // behavior: typing a URL into a freshly created request sets its name from the
  // URL path.
  it("should set a new request's name from its URL while it is unnamed", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: /new request/i }));
    await user.click(screen.getByRole("button", { name: /^type url$/i }));

    expect(screen.getByTestId("active-name")).toHaveTextContent("/widgets/list");
  });

  // behavior: the auto-name keeps tracking further URL edits (still unnamed).
  it("should keep tracking the URL while the new request stays unnamed", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: /new request/i }));
    await user.click(screen.getByRole("button", { name: /^type url$/i }));
    await user.click(screen.getByRole("button", { name: /type url again/i }));

    expect(screen.getByTestId("active-name")).toHaveTextContent("/changed");
  });

  // behavior: once the user renames the request, URL edits no longer change the
  // name (the name is now established).
  it("should stop auto-naming after the request is renamed", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: /new request/i }));
    await user.click(screen.getByRole("button", { name: /commit rename/i }));
    expect(screen.getByTestId("active-name")).toHaveTextContent("My Name");

    await user.click(screen.getByRole("button", { name: /type url again/i }));

    // name is unchanged - the URL no longer drives it.
    expect(screen.getByTestId("active-name")).toHaveTextContent("My Name");
  });

  // behavior: starting a manual rename (even without committing) ends auto-name.
  it("should stop auto-naming once the user begins a manual rename", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: /new request/i }));
    await user.click(screen.getByRole("button", { name: /^type url$/i }));
    expect(screen.getByTestId("active-name")).toHaveTextContent("/widgets/list");

    await user.click(screen.getByRole("button", { name: /begin rename/i }));
    await user.click(screen.getByRole("button", { name: /type url again/i }));

    // begin-rename signals the user is naming it -> URL no longer drives it.
    expect(screen.getByTestId("active-name")).toHaveTextContent("/widgets/list");
  });

  // behavior: an already-saved (existing) request never auto-names from a URL edit.
  it("should not auto-name an already-saved request when its URL changes", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: /activate profile/i }));
    expect(screen.getByTestId("active-name")).toHaveTextContent("profile");

    await user.click(screen.getByRole("button", { name: /edit profile url/i }));

    // the saved request keeps its name.
    expect(screen.getByTestId("active-name")).toHaveTextContent("profile");
  });
});

// Integration: drive the REAL sidebar + URL input (not a probe). This is the
// path the probe missed - the sidebar row reads the merged name, not the tree
// node, so typing into the URL must rename the visible tree row.
function NewRequestControl() {
  const { newRequest } = useWorkspace();
  return (
    <button type="button" onClick={() => newRequest()}>
      new request
    </button>
  );
}

describe("request auto-name reflected in the sidebar tree row", () => {
  it("should update the sidebar tree row label as the URL is typed into the URL input", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
          <NewRequestControl />
          <SidebarTree />
          <UrlBar />
        </WorkspaceProvider>
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /new request/i }));

    const tree = screen.getByRole("tree", { name: /collection/i });
    // freshly created: the row shows the default name.
    expect(
      within(tree).getByRole("treeitem", { name: /New Request/i }),
    ).toBeInTheDocument();

    // type into the real URL input.
    const urlInput = screen.getByRole("textbox", { name: /url/i });
    await user.type(urlInput, "{{baseUrl}}/widgets");

    // the sidebar row label now reflects the URL path.
    expect(
      within(tree).getByRole("treeitem", { name: /\/widgets/ }),
    ).toBeInTheDocument();
    expect(
      within(tree).queryByRole("treeitem", { name: /New Request/i }),
    ).not.toBeInTheDocument();
  });

  it("should focus the URL input when New request is chosen from the empty-area context menu", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
          <SidebarTree />
          <UrlBar />
        </WorkspaceProvider>
      </ToastProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    fireEvent.contextMenu(tree.parentElement as HTMLElement);
    await user.click(
      await screen.findByRole("menuitem", { name: /new request/i }),
    );

    const urlInput = await screen.findByRole("textbox", { name: /url/i });
    await waitFor(() => expect(urlInput).toHaveFocus());
  });

  it("should focus the URL input when New request is chosen from a folder context menu", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <WorkspaceProvider tree={fixtureTree} initialExpandedIds={[]}>
          <SidebarTree />
          <UrlBar />
        </WorkspaceProvider>
      </ToastProvider>,
    );

    const tree = screen.getByRole("tree", { name: /collection/i });
    fireEvent.contextMenu(
      within(tree).getByRole("treeitem", { name: /auth/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /new request/i }),
    );

    const urlInput = await screen.findByRole("textbox", { name: /url/i });
    await waitFor(() => expect(urlInput).toHaveFocus());
  });
});
