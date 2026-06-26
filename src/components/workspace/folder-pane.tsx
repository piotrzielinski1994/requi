import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PANE_TABS_LIST,
  PANE_TABS_TRIGGER,
} from "@/components/workspace/pane-tabs";
import { ConfigEditorForm } from "@/components/workspace/config-editor";
import {
  AuthPanel,
  HeadersPanel,
  ParamsPanel,
  ScriptPanel,
  VarsPanel,
} from "@/components/workspace/config-panels";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { findNode } from "@/lib/workspace/tree-locate";
import { updateNodeConfig } from "@/lib/workspace/update-config";
import type { ConfigScope } from "@/lib/workspace/model";

type FolderTab = "vars" | "auth" | "headers" | "params" | "script" | "settings";

// Registers the folder's structured-config draft on the active-editor seam (so
// Cmd+S + close-confirm work) and renders the structured panels. Mounted ONLY on
// non-Settings sub-tabs - the Settings sub-tab's own RawJsonEditor owns the seam
// there. Making this a separately-mounted child (vs a `tab === "settings"`-gated
// effect in the parent) means it and the RawJsonEditor mount/unmount mutually
// exclusively, so React's unmount-before-mount ordering makes exactly one editor
// own the slot - no registration race that could clobber the Settings JSON save.
function FolderStructuredEditor({
  id,
  saved,
}: {
  id: string;
  saved: ConfigScope;
}) {
  const { saveNodeConfig, registerActiveEditor } = useWorkspace();

  // Local draft: structured-panel edits buffer here (like a request's
  // requestOverrides) and persist only on Cmd+S. Re-seed when the node OR its
  // saved config changes identity - keyed by `id:savedKey` so a fresh-but-equal
  // saved object doesn't reset a pending edit.
  const savedKey = JSON.stringify(saved);
  const seedKey = `${id}:${savedKey}`;
  const [draft, setDraft] = useState<ConfigScope>(saved);
  const [seed, setSeed] = useState(seedKey);
  if (seed !== seedKey) {
    setSeed(seedKey);
    setDraft(saved);
  }

  const isDirty = JSON.stringify(draft) !== savedKey;

  // save/commit read the LATEST draft via a ref so the registration effect doesn't
  // re-run on every keystroke (and `saveNodeConfig` is recreated each provider
  // render, so it's held in the ref too - keeping it out of the effect deps).
  const behaviorRef = useRef({ draft, saveNodeConfig });
  useEffect(() => {
    behaviorRef.current = { draft, saveNodeConfig };
  });

  useEffect(() => {
    registerActiveEditor({
      scope: { kind: "config", id },
      isDirty,
      canSave: true,
      save: () =>
        behaviorRef.current.saveNodeConfig(id, behaviorRef.current.draft),
      commitToTree: (currentTree) =>
        updateNodeConfig(currentTree, id, behaviorRef.current.draft),
    });
    return () => registerActiveEditor(null);
  }, [id, isDirty, registerActiveEditor]);

  return (
    <>
      <TabsContent value="vars">
        <VarsPanel config={draft} onChange={setDraft} />
      </TabsContent>
      <TabsContent value="auth">
        <AuthPanel config={draft} onChange={setDraft} />
      </TabsContent>
      <TabsContent value="headers">
        <HeadersPanel config={draft} onChange={setDraft} />
      </TabsContent>
      <TabsContent value="params">
        <ParamsPanel config={draft} onChange={setDraft} />
      </TabsContent>
      <TabsContent value="script">
        <ScriptPanel config={draft} onChange={setDraft} />
      </TabsContent>
    </>
  );
}

export function FolderPane() {
  const { editTarget, tree } = useWorkspace();
  const [tab, setTab] = useState<FolderTab>("vars");

  const node =
    editTarget?.kind === "config" ? findNode(tree, editTarget.id) : null;
  const folder = node && node.kind === "folder" ? node : null;

  if (!folder) {
    return null;
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as FolderTab)}
      className="flex h-full flex-col gap-0"
    >
      <div className="flex h-10.25 items-stretch overflow-x-auto border-b bg-muted/30">
        <TabsList aria-label="Folder sections" className={PANE_TABS_LIST}>
          <TabsTrigger value="vars" className={PANE_TABS_TRIGGER}>
            Vars
          </TabsTrigger>
          <TabsTrigger value="auth" className={PANE_TABS_TRIGGER}>
            Auth
          </TabsTrigger>
          <TabsTrigger value="headers" className={PANE_TABS_TRIGGER}>
            Headers
          </TabsTrigger>
          <TabsTrigger value="params" className={PANE_TABS_TRIGGER}>
            Params
          </TabsTrigger>
          <TabsTrigger value="script" className={PANE_TABS_TRIGGER}>
            Script
          </TabsTrigger>
          <TabsTrigger value="settings" className={PANE_TABS_TRIGGER}>
            Settings
          </TabsTrigger>
        </TabsList>
      </div>
      {tab === "settings" ? (
        <TabsContent value="settings" className="min-h-0 flex-1">
          <ConfigEditorForm
            key={folder.id}
            id={folder.id}
            config={folder.config}
          />
        </TabsContent>
      ) : (
        <FolderStructuredEditor id={folder.id} saved={folder.config} />
      )}
    </Tabs>
  );
}
