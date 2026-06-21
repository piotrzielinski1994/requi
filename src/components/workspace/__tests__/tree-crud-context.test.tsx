import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/workspace/workspace-context";
import { ToastProvider } from "@/components/ui/toast";
import type { MoveTarget } from "@/lib/workspace/move";
import type { RequestNode, TreeNode } from "@/lib/workspace/model";
import { serialize, deserialize } from "@/lib/workspace/disk-format";
import { fixtureTree } from "./fixtures";

// The tree-crud surface on the context, narrowed onto the existing value for the
// probe below.
type PendingDelete = { id: string } | null;

type CrudSurface = ReturnType<typeof useWorkspace> & {
  renamingNodeId: string | null;
  beginRename: (id: string) => void;
  commitRename: (id: string, name: string) => void;
  cancelRename: () => void;
  newFolder: (target?: MoveTarget) => void;
  duplicateRequest: (id: string) => void;
  pendingDelete: PendingDelete;
  requestDeleteNode: (id: string) => void;
  confirmPendingDelete: () => void;
  cancelPendingDelete: () => void;
  newRequest: (target?: MoveTarget) => void;
};

const collect = (nodes: TreeNode[]): TreeNode[] =>
  nodes.flatMap((node) =>
    node.kind === "folder" ? [node, ...collect(node.children)] : [node],
  );

function CrudProbe() {
  const ctx = useWorkspace() as CrudSurface;
  const {
    tree,
    expandedFolderIds,
    selectedNodeId,
    activeRequestId,
    openRequestIds,
    renamingNodeId,
    pendingDelete,
    setRequestUrl,
    setRequestMethod,
    selectNode,
    setActiveRequest,
    newRequest,
    newFolder,
    saveActiveRequest,
    beginRename,
    commitRename,
    cancelRename,
    duplicateRequest,
    requestDeleteNode,
    confirmPendingDelete,
    cancelPendingDelete,
  } = ctx;

  const treeNodes = collect(tree);
  const requestNodes = treeNodes.filter(
    (node): node is RequestNode => node.kind === "request",
  );
  const folderCount = treeNodes.length - requestNodes.length;

  return (
    <div>
      <span data-testid="active-id">{activeRequestId ?? "none"}</span>
      <span data-testid="selected-id">{selectedNodeId ?? "none"}</span>
      <span data-testid="open-count">{openRequestIds.length}</span>
      <span data-testid="open-ids">{openRequestIds.join(",") || "none"}</span>
      <span data-testid="request-count">{requestNodes.length}</span>
      <span data-testid="folder-count">{folderCount}</span>
      <span data-testid="tree-ids">
        {treeNodes.map((node) => node.id).join(",")}
      </span>
      <span data-testid="tree-names">
        {treeNodes.map((node) => node.name).join(",")}
      </span>
      <span data-testid="renaming-id">{renamingNodeId ?? "none"}</span>
      <span data-testid="pending-delete">
        {pendingDelete ? pendingDelete.id : "none"}
      </span>
      <span data-testid="has-actions">
        {[
          typeof commitRename === "function",
          typeof duplicateRequest === "function",
          typeof newFolder === "function",
          typeof beginRename === "function",
          typeof requestDeleteNode === "function",
        ].every(Boolean)
          ? "yes"
          : "no"}
      </span>
      <span data-testid="expanded-ids">
        {[...expandedFolderIds].sort().join(",") || "none"}
      </span>

      <button type="button" onClick={() => newRequest()}>
        new request root
      </button>
      <button
        type="button"
        onClick={() => newRequest({ parentId: "folder-users", index: 0 })}
      >
        new request in users
      </button>
      <button
        type="button"
        onClick={() => {
          if (activeRequestId !== null) {
            setRequestUrl(activeRequestId, "https://created.test/path");
            setRequestMethod(activeRequestId, "POST");
          }
        }}
      >
        edit active request
      </button>
      <button type="button" onClick={() => saveActiveRequest()}>
        save active
      </button>
      <button type="button" onClick={() => newFolder()}>
        new folder root
      </button>
      <button
        type="button"
        onClick={() => newFolder({ parentId: "folder-users", index: 0 })}
      >
        new folder in users
      </button>
      <button type="button" onClick={() => selectNode("folder-users")}>
        select users folder
      </button>
      <button type="button" onClick={() => setActiveRequest("req-profile")}>
        activate profile
      </button>
      <button type="button" onClick={() => beginRename("req-profile")}>
        begin rename profile
      </button>
      <button
        type="button"
        onClick={() => commitRename("req-profile", "renamed-profile")}
      >
        commit rename profile
      </button>
      <button
        type="button"
        onClick={() => commitRename("folder-users", "Renamed Users")}
      >
        commit rename users folder
      </button>
      <button type="button" onClick={() => commitRename("req-profile", "   ")}>
        commit blank rename
      </button>
      <button type="button" onClick={() => cancelRename()}>
        cancel rename
      </button>
      <button
        type="button"
        onClick={() => {
          if (renamingNodeId !== null) {
            commitRename(renamingNodeId, "My New Folder");
          }
        }}
      >
        commit rename current
      </button>
      <button type="button" onClick={() => duplicateRequest("req-profile")}>
        duplicate profile
      </button>
      <button type="button" onClick={() => duplicateRequest("folder-users")}>
        duplicate users folder
      </button>
      <button type="button" onClick={() => requestDeleteNode("req-session")}>
        delete session request
      </button>
      <button type="button" onClick={() => requestDeleteNode("folder-empty")}>
        delete empty folder
      </button>
      <button type="button" onClick={() => requestDeleteNode("folder-auth")}>
        delete auth folder
      </button>
      <button type="button" onClick={() => confirmPendingDelete()}>
        confirm delete
      </button>
      <button type="button" onClick={() => cancelPendingDelete()}>
        cancel delete
      </button>
    </div>
  );
}

type OnTreeChange = (
  tree: TreeNode[],
) => Promise<{ ok: true } | { ok: false; error: string }>;

// fixtureTree has no empty folder; add one so the immediate-delete path
// (empty folder -> no dialog) is exercisable.
const emptyFolder: TreeNode = {
  kind: "folder",
  id: "folder-empty",
  name: "Empty",
  config: {},
  children: [],
};
const crudTree: TreeNode[] = [...fixtureTree, emptyFolder];

function renderProbe(
  props: {
    onTreeChange?: OnTreeChange;
    initialActiveRequestId?: string;
    initialOpenRequestIds?: string[];
    initialExpandedIds?: string[];
  } = {},
) {
  return render(
    <ToastProvider>
      <WorkspaceProvider tree={crudTree} {...props}>
        <CrudProbe />
        <ConsoleProbe />
      </WorkspaceProvider>
    </ToastProvider>,
  );
}

function ConsoleProbe() {
  const { consoleLines } = useWorkspace();
  return (
    <ul data-testid="console">
      {consoleLines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

describe("WorkspaceProvider create request (immediate)", () => {
  // AC-001, AC-002, TC-001 - side-effect-contract: new request inserts a real
  // node inside the selected folder, persists immediately, opens + activates +
  // selects its tab (focus goes to the URL input, not inline rename); the
  // round-trip reproduces it.
  it("should insert a request into the selected folder, persist, and open its tab", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /select users folder/i }),
    );
    await user.click(screen.getByRole("button", { name: /new request root/i }));

    // persisted immediately on create (no draft/save step).
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    // the new node is the active + selected tab.
    const activeId = screen.getByTestId("active-id").textContent ?? "";
    expect(activeId).not.toBe("none");
    expect(activeId).not.toMatch(/draft-/);
    expect(screen.getByTestId("open-ids").textContent).toContain(activeId);
    expect(screen.getByTestId("selected-id")).toHaveTextContent(activeId);
    // a new REQUEST focuses the URL input (a new FOLDER begins inline rename),
    // so it is NOT in the renaming state.
    expect(screen.getByTestId("renaming-id")).toHaveTextContent("none");

    // it lives under the Users folder in the round-tripped tree.
    const persisted = onTreeChange.mock.calls[0][0];
    const roundTrip = deserialize(serialize(persisted));
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) {
      throw new Error("expected round-trip to succeed");
    }
    const usersFolder = collect(roundTrip.tree).find(
      (node) => node.kind === "folder" && node.name === "Users",
    );
    expect(usersFolder?.kind).toBe("folder");
    if (!usersFolder || usersFolder.kind !== "folder") {
      throw new Error("expected the Users folder in the round-tripped tree");
    }
    expect(
      usersFolder.children.filter((node) => node.kind === "request").length,
    ).toBeGreaterThan(1);
  });

  // AC-001 - side-effect-contract: a freshly created request can still be edited
  // and saved through the normal url/method override -> save path.
  it("should let the created request be edited and saved like any on-disk request", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(screen.getByRole("button", { name: /new request root/i }));
    await user.click(screen.getByRole("button", { name: /edit active request/i }));
    await user.click(screen.getByRole("button", { name: /save active/i }));

    // create (1) + edit-save (2).
    expect(onTreeChange).toHaveBeenCalledTimes(2);
    const persisted = onTreeChange.mock.calls[1][0];
    const created = collect(persisted).find(
      (node) =>
        node.kind === "request" && node.url === "https://created.test/path",
    );
    expect(created).toBeDefined();
    expect(created?.kind === "request" && created.method).toBe("POST");
  });

  // AC-002, TC-002 - side-effect-contract: with nothing selected the new request
  // is appended at workspace root.
  it("should append the new request at workspace root if nothing is selected", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(screen.getByRole("button", { name: /new request root/i }));

    const persisted = onTreeChange.mock.calls[0][0];
    const activeId = screen.getByTestId("active-id").textContent ?? "";
    // present at the ROOT level (not nested in a folder).
    const created = persisted.find((node) => node.id === activeId);
    expect(created).toBeDefined();
    expect(created?.kind).toBe("request");
  });

  // AC-002 - behavior: a request created with an explicit folder target lands in
  // that folder regardless of selection.
  it("should place the new request in the explicit target folder", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /new request in users/i }),
    );

    const persisted = onTreeChange.mock.calls[0][0];
    const activeId = screen.getByTestId("active-id").textContent ?? "";
    const usersFolder = persisted.find(
      (node) => node.kind === "folder" && node.id === "folder-users",
    );
    expect(usersFolder?.kind).toBe("folder");
    if (!usersFolder || usersFolder.kind !== "folder") {
      throw new Error("expected the users folder");
    }
    expect(
      usersFolder.children.some((node) => node.id === activeId),
    ).toBe(true);
  });
});

describe("WorkspaceProvider newFolder (AC-003, TC-003)", () => {
  // AC-003, TC-003 - side-effect-contract: newFolder inserts a folder, persists,
  // expands + selects the parent target, and enters inline rename on the folder.
  it("should insert a folder inside the target, expand+select it, and begin rename", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    const foldersBefore = Number(
      screen.getByTestId("folder-count").textContent ?? "0",
    );

    await user.click(
      screen.getByRole("button", { name: /new folder in users/i }),
    );

    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("folder-count")).toHaveTextContent(
      String(foldersBefore + 1),
    );
    // parent folder is expanded so the new child is visible.
    expect(screen.getByTestId("expanded-ids").textContent).toContain(
      "folder-users",
    );
    // the new folder is selected and in the renaming state (same id).
    const selected = screen.getByTestId("selected-id").textContent ?? "";
    expect(selected).not.toBe("none");
    expect(selected).not.toBe("folder-users");
    expect(screen.getByTestId("renaming-id")).toHaveTextContent(selected);
  });

  // AC-003, TC-003 - side-effect-contract: committing the inline rename of the
  // freshly created folder persists it under the new name; the round-trip
  // reproduces it.
  it("should persist the new folder under the committed name (round-trip)", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(screen.getByRole("button", { name: /new folder root/i }));
    const newId = screen.getByTestId("renaming-id").textContent ?? "";
    expect(newId).not.toBe("none");
    // newFolder already persisted once (folder.json written on create).
    expect(onTreeChange).toHaveBeenCalledTimes(1);

    // commit the inline rename on the just-created folder (read from
    // renamingNodeId), which persists again under the new name.
    await user.click(
      screen.getByRole("button", { name: /commit rename current/i }),
    );

    expect(onTreeChange).toHaveBeenCalledTimes(2);
    const persisted = onTreeChange.mock.calls[1][0];
    const roundTrip = deserialize(serialize(persisted));
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) {
      throw new Error("expected round-trip to succeed");
    }
    expect(
      collect(roundTrip.tree).some(
        (node) => node.kind === "folder" && node.name === "My New Folder",
      ),
    ).toBe(true);
    // renaming state cleared after the commit.
    expect(screen.getByTestId("renaming-id")).toHaveTextContent("none");
  });
});

describe("WorkspaceProvider rename (AC-004, TC-004/005/006)", () => {
  // AC-004, TC-004 - side-effect-contract: commitRename writes via onTreeChange
  // and renames the node.
  it("should rename the node and persist if a non-blank name is committed", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /commit rename profile/i }),
    );

    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tree-names").textContent).toContain(
      "renamed-profile",
    );
    // renaming state is cleared after a commit.
    expect(screen.getByTestId("renaming-id")).toHaveTextContent("none");
  });

  // AC-004 - behavior: beginRename sets renamingNodeId; cancelRename clears it
  // with no write.
  it("should set renamingNodeId on begin and clear it on cancel without writing", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /begin rename profile/i }),
    );
    expect(screen.getByTestId("renaming-id")).toHaveTextContent("req-profile");

    await user.click(screen.getByRole("button", { name: /cancel rename/i }));
    expect(screen.getByTestId("renaming-id")).toHaveTextContent("none");
    expect(onTreeChange).not.toHaveBeenCalled();
  });

  // AC-004, TC-005 - behavior: a blank/whitespace rename is rejected (no write,
  // name unchanged).
  it("should not write or change the name if a blank rename is committed", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    // RED guard: the crud actions must be wired for this no-op to be meaningful
    // (else it passes trivially because commitRename doesn't exist).
    expect(screen.getByTestId("has-actions")).toHaveTextContent("yes");

    await user.click(
      screen.getByRole("button", { name: /commit blank rename/i }),
    );

    expect(onTreeChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("tree-names").textContent).toContain("profile");
  });

  // AC-004, TC-006 - side-effect-contract: a folder rename persists and the
  // round-tripped tree keeps the renamed folder + its descendant.
  it("should rename a folder and round-trip the new name with descendants", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /commit rename users folder/i }),
    );

    expect(onTreeChange).toHaveBeenCalledTimes(1);
    const persisted = onTreeChange.mock.calls[0][0];
    const roundTrip = deserialize(serialize(persisted));
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) {
      throw new Error("expected round-trip to succeed");
    }
    const renamed = collect(roundTrip.tree).find(
      (node) => node.kind === "folder" && node.name === "Renamed Users",
    );
    expect(renamed?.kind).toBe("folder");
    if (!renamed || renamed.kind !== "folder") {
      throw new Error("expected the renamed folder");
    }
    // its descendant (profile request) survives the path rewrite.
    expect(renamed.children.some((node) => node.kind === "request")).toBe(true);
  });
});

describe("WorkspaceProvider delete immediate (AC-005, TC-007/008)", () => {
  // AC-005, TC-007 - side-effect-contract: deleting an open request removes it,
  // closes its tab, sets no pendingDelete, and persists.
  it("should remove a request immediately, close its tab, and persist with no pending delete", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({
      onTreeChange,
      initialActiveRequestId: "req-session",
      initialOpenRequestIds: ["req-session"],
    });

    expect(screen.getByTestId("open-count")).toHaveTextContent("1");

    await user.click(
      screen.getByRole("button", { name: /delete session request/i }),
    );

    expect(screen.getByTestId("pending-delete")).toHaveTextContent("none");
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    // tab closed.
    expect(screen.getByTestId("open-count")).toHaveTextContent("0");
    // gone from the tree.
    expect(screen.getByTestId("tree-ids").textContent).not.toContain(
      "req-session",
    );
  });

  // AC-005, TC-008 - side-effect-contract: deleting an empty folder removes it
  // immediately (no dialog), persists.
  it("should remove an empty folder immediately with no pending delete", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /delete empty folder/i }),
    );

    expect(screen.getByTestId("pending-delete")).toHaveTextContent("none");
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tree-ids").textContent).not.toContain(
      "folder-empty",
    );
  });
});

describe("WorkspaceProvider delete non-empty folder (AC-006, TC-009/010)", () => {
  // AC-006, TC-009 - side-effect-contract: deleting a non-empty folder sets
  // pendingDelete (dialog) without writing; confirm removes the folder + every
  // descendant and closes their tabs.
  it("should set pendingDelete then remove the folder and descendants on confirm", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    // folder-auth contains folder-oauth -> req-token; open that request.
    renderProbe({
      onTreeChange,
      initialActiveRequestId: "req-token",
      initialOpenRequestIds: ["req-token"],
      initialExpandedIds: ["folder-auth", "folder-oauth"],
    });

    await user.click(
      screen.getByRole("button", { name: /delete auth folder/i }),
    );

    // dialog state set, NOTHING written yet, tab still open.
    expect(screen.getByTestId("pending-delete")).toHaveTextContent(
      "folder-auth",
    );
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("open-count")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(screen.getByTestId("pending-delete")).toHaveTextContent("none");
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    // folder + descendants gone.
    expect(screen.getByTestId("tree-ids").textContent).not.toContain(
      "folder-auth",
    );
    expect(screen.getByTestId("tree-ids").textContent).not.toContain(
      "req-token",
    );
    // the descendant request's tab is closed.
    expect(screen.getByTestId("open-count")).toHaveTextContent("0");
  });

  // AC-006, TC-010 - side-effect-contract: cancelling the pending delete keeps
  // everything (no write).
  it("should keep the folder and write nothing if the pending delete is cancelled", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /delete auth folder/i }),
    );
    expect(screen.getByTestId("pending-delete")).toHaveTextContent(
      "folder-auth",
    );

    await user.click(screen.getByRole("button", { name: /cancel delete/i }));

    expect(screen.getByTestId("pending-delete")).toHaveTextContent("none");
    expect(onTreeChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("tree-ids").textContent).toContain("folder-auth");
  });
});

describe("WorkspaceProvider duplicateRequest (AC-007, TC-011)", () => {
  // AC-007, TC-011 - side-effect-contract: duplicate inserts a copy after the
  // original, persists, and opens+activates the copy.
  it("should insert a copy after the original, persist, and activate the copy", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    const requestsBefore = Number(
      screen.getByTestId("request-count").textContent ?? "0",
    );

    await user.click(
      screen.getByRole("button", { name: /duplicate profile/i }),
    );

    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("request-count")).toHaveTextContent(
      String(requestsBefore + 1),
    );
    // a "<name> copy" request now exists.
    expect(screen.getByTestId("tree-names").textContent).toContain(
      "profile copy",
    );
    // the copy is the active tab (a fresh, non-draft id, not the original).
    const activeId = screen.getByTestId("active-id").textContent ?? "";
    expect(activeId).not.toBe("none");
    expect(activeId).not.toBe("req-profile");
    expect(screen.getByTestId("open-ids").textContent).toContain(activeId);
  });

  // AC-007 - behavior: duplicate on a folder is a no-op (no write, no new node).
  it("should be a no-op if duplicate is invoked on a folder", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi.fn<OnTreeChange>().mockResolvedValue({ ok: true });
    renderProbe({ onTreeChange });

    // RED guard: the crud actions must be wired for this no-op to be meaningful
    // (else it passes trivially because duplicateRequest doesn't exist).
    expect(screen.getByTestId("has-actions")).toHaveTextContent("yes");

    const requestsBefore = screen.getByTestId("request-count").textContent;

    await user.click(
      screen.getByRole("button", { name: /duplicate users folder/i }),
    );

    expect(onTreeChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("request-count")).toHaveTextContent(
      requestsBefore ?? "",
    );
  });
});

describe("WorkspaceProvider persist failure (AC-010, TC-015)", () => {
  // AC-010, TC-015 - side-effect-contract: a {ok:false} write keeps the change
  // in the tree and appends a "[workspace] failed to persist <label>" line.
  it("should keep the change and append a failed-to-persist console line if the write fails", async () => {
    const user = userEvent.setup();
    const onTreeChange = vi
      .fn<OnTreeChange>()
      .mockResolvedValue({ ok: false, error: "EACCES" });
    renderProbe({ onTreeChange });

    await user.click(
      screen.getByRole("button", { name: /duplicate profile/i }),
    );

    // in-memory change kept.
    expect(screen.getByTestId("tree-names").textContent).toContain(
      "profile copy",
    );
    // the failed-to-persist line is appended.
    expect(await screen.findByText(/failed to persist/i)).toBeInTheDocument();
  });

  // AC-010, spec §6 - side-effect-contract: with NO onTreeChange (browser dev,
  // no Tauri host) an op still folds into the in-memory tree (and no
  // failed-to-persist line is logged).
  it("should fold the change into the in-memory tree if there is no onTreeChange", async () => {
    const user = userEvent.setup();
    // no onTreeChange prop -> the in-session branch.
    renderProbe({});

    await user.click(
      screen.getByRole("button", { name: /duplicate profile/i }),
    );

    // the copy exists in-memory.
    expect(screen.getByTestId("tree-names").textContent).toContain(
      "profile copy",
    );
    // nothing failed (no persistence attempted).
    expect(screen.queryByText(/failed to persist/i)).not.toBeInTheDocument();
  });
});
