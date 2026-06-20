import { describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorView } from "@codemirror/view";

import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/workspace/workspace-context";
import { RequestPane } from "@/components/workspace/request-pane";
import { SidebarTree } from "@/components/workspace/sidebar-tree";
import { ToastProvider } from "@/components/ui/toast";
import type { ConfigScope, TreeNode } from "@/lib/workspace/model";
import { createFakeHttpClient } from "./fake-http-client";

function SaveActiveEditorButton() {
  const { saveActiveEditor } = useWorkspace();
  return (
    <button type="button" onClick={saveActiveEditor}>
      fire shortcut
    </button>
  );
}

const REQ_CONFIG: ConfigScope = {
  headers: [{ key: "Accept", value: "application/json" }],
};

const tree: TreeNode[] = [
  {
    kind: "request",
    id: "req-1",
    name: "Req",
    method: "GET",
    url: "https://api/get",
    body: "",
    config: REQ_CONFIG,
  },
];

function liveDoc(): string {
  const el = document.querySelector<HTMLElement>(".cm-editor");
  if (!el) {
    throw new Error(".cm-editor not found");
  }
  const view = EditorView.findFromDOM(el);
  if (!view) {
    throw new Error("live EditorView not found");
  }
  return view.state.doc.toString();
}

function setDoc(text: string) {
  const view = EditorView.findFromDOM(
    document.querySelector<HTMLElement>(".cm-editor")!,
  )!;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

function renderPane(onTreeChange = vi.fn().mockResolvedValue({ ok: true })) {
  return render(
    <ToastProvider>
      <WorkspaceProvider
        tree={tree}
        initialActiveRequestId="req-1"
        httpClient={createFakeHttpClient()}
        onTreeChange={onTreeChange}
      >
        <RequestPane />
      </WorkspaceProvider>
    </ToastProvider>,
  );
}

describe("RequestPane Settings sub-tab", () => {
  // behavior: a Settings sub-tab exists alongside the other request sections
  it("should expose a Settings sub-tab in the request sections", () => {
    renderPane();

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    expect(
      within(tablist).getByRole("tab", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  // behavior: the Settings sub-tab shows the request config as editable JSON
  it("should show the request config as raw JSON in the Settings sub-tab", async () => {
    const user = userEvent.setup();
    renderPane();

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Settings" }));

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).not.toBeNull();
    });
    expect(liveDoc()).toBe(JSON.stringify(REQ_CONFIG, null, 2));
  });

  // behavior: editing + Save persists the request config via onTreeChange
  it("should persist the edited request config when Save is clicked", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn().mockResolvedValue({ ok: true });
    renderPane(onTreeChange);

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Settings" }));
    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).not.toBeNull();
    });

    const edited = { variables: { token: "abc" } };
    setDoc(JSON.stringify(edited));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onTreeChange).toHaveBeenCalledTimes(1);
    });
    const next = onTreeChange.mock.calls[0][0] as TreeNode[];
    expect(next.find((n) => n.id === "req-1")?.config).toEqual(edited);
  });

  // behavior: a successful save shows a confirmation toast
  it("should show a saved toast when the config persists successfully", async () => {
    const user = userEvent.setup();
    renderPane(vi.fn().mockResolvedValue({ ok: true }));

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Settings" }));
    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).not.toBeNull();
    });

    setDoc(JSON.stringify({ variables: { token: "abc" } }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  // behavior: the save shortcut persists the active config editor without
  // clicking Save (the Mod+S handler routes through saveActiveEditor).
  it("should persist the edited config when the save shortcut fires", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ToastProvider>
        <WorkspaceProvider
          tree={tree}
          initialActiveRequestId="req-1"
          httpClient={createFakeHttpClient()}
          onTreeChange={onTreeChange}
        >
          <SaveActiveEditorButton />
          <RequestPane />
        </WorkspaceProvider>
      </ToastProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Settings" }));
    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).not.toBeNull();
    });

    const edited = { variables: { token: "via-hotkey" } };
    setDoc(JSON.stringify(edited));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /fire shortcut/i }));

    await waitFor(() => {
      expect(onTreeChange).toHaveBeenCalledTimes(1);
    });
    const next = onTreeChange.mock.calls[0][0] as TreeNode[];
    expect(next.find((n) => n.id === "req-1")?.config).toEqual(edited);
  });

  // behavior: a failed save surfaces an error toast
  it("should show an error toast when the config fails to persist", async () => {
    const user = userEvent.setup();
    renderPane(vi.fn().mockResolvedValue({ ok: false, error: "disk full" }));

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    await user.click(within(tablist).getByRole("tab", { name: "Settings" }));
    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).not.toBeNull();
    });

    setDoc(JSON.stringify({ variables: { token: "abc" } }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/disk full/i)).toBeInTheDocument();
  });
});

describe("Request pencil opens the Settings sub-tab", () => {
  // behavior: clicking a request row's edit-config control opens the request
  // and activates its Settings sub-tab (NO separate top-level editor tab).
  it("should activate the request Settings sub-tab when the row edit-config control is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider tree={tree} httpClient={createFakeHttpClient()}>
        <SidebarTree />
        <RequestPane />
      </WorkspaceProvider>,
    );

    const treeEl = screen.getByRole("tree", { name: /collection/i });
    const row = within(treeEl).getByRole("treeitem", { name: /Req/i });
    await user.click(within(row).getByRole("button", { name: /edit config/i }));

    const tablist = screen.getByRole("tablist", { name: /request sections/i });
    expect(
      within(tablist).getByRole("tab", { name: "Settings" }),
    ).toHaveAttribute("aria-selected", "true");
    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).not.toBeNull();
    });
  });
});
