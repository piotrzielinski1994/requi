import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { syntaxHighlighting } from "@codemirror/language";
import { Button } from "@/components/ui/button";
import {
  darculaChrome,
  darculaHighlight,
} from "@/components/workspace/editor-theme";
import { useWorkspace } from "@/components/workspace/workspace-context";

const extensions = [darculaChrome, syntaxHighlighting(darculaHighlight)];

function EnvEditorForm({ seed }: { seed: string }) {
  const { saveEnv, registerEditorSaver } = useWorkspace();
  const [text, setText] = useState(seed);

  useEffect(() => {
    registerEditorSaver(() => saveEnv(text));
    return () => registerEditorSaver(null);
  }, [text, saveEnv, registerEditorSaver]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10.25 items-stretch justify-between border-b bg-muted/30">
        <span className="flex items-center px-3 font-mono text-xs text-muted-foreground">
          .env
        </span>
        <Button
          type="button"
          className="h-full rounded-none border-0 border-l border-l-border"
          onClick={() => saveEnv(text)}
        >
          Save
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeMirror
          value={text}
          onChange={setText}
          theme="none"
          extensions={extensions}
          height="100%"
          className="h-full text-xs"
        />
      </div>
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
