import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { useEditorExtensions } from "@/components/workspace/use-editor-extensions";
import { useWorkspace } from "@/components/workspace/workspace-context";

// No Save bar - saved via Mod+S or the close-confirm popup. `.env` is free text
// (always saveable), so no `commitToTree`; save writes envText directly.
function EnvEditorForm({ seed }: { seed: string }) {
  const { saveEnv, registerActiveEditor } = useWorkspace();
  const { envExtensions } = useEditorExtensions();
  const [text, setText] = useState(seed);

  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    saveRef.current = () => saveEnv(text);
  }, [text, saveEnv]);

  const isDirty = text !== seed;
  useEffect(() => {
    registerActiveEditor({
      scope: { kind: "env" },
      isDirty,
      canSave: true,
      save: () => saveRef.current(),
    });
    return () => registerActiveEditor(null);
  }, [isDirty, registerActiveEditor]);

  return (
    <div className="min-h-0 flex-1">
      <CodeMirror
        value={text}
        onChange={setText}
        theme="none"
        extensions={envExtensions}
        height="100%"
        className="h-full text-xs"
      />
    </div>
  );
}

export function EnvEditor() {
  const { editTarget, envText } = useWorkspace();
  if (editTarget?.kind !== "env") {
    return null;
  }
  return <EnvEditorForm seed={envText} />;
}
