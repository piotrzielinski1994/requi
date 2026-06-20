import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { syntaxHighlighting } from "@codemirror/language";
import { Button } from "@/components/ui/button";
import {
  darculaChrome,
  darculaHighlight,
} from "@/components/workspace/editor-theme";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { ConfigScope } from "@/lib/workspace/model";

const extensions = [json(), darculaChrome, syntaxHighlighting(darculaHighlight)];

function parseConfig(text: string): ConfigScope | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as ConfigScope;
  } catch {
    return null;
  }
}

// Reusable raw-JSON config editor for any node (request Settings sub-tab, folder pane).
export function ConfigEditorForm({
  id,
  config,
  title,
}: {
  id: string;
  config: ConfigScope;
  title?: string;
}) {
  const { saveNodeConfig, registerEditorSaver } = useWorkspace();
  const [text, setText] = useState(() => JSON.stringify(config, null, 2));
  const parsed = parseConfig(text);

  useEffect(() => {
    registerEditorSaver(() => {
      if (parsed !== null) {
        saveNodeConfig(id, parsed);
      }
    });
    return () => registerEditorSaver(null);
  }, [id, parsed, saveNodeConfig, registerEditorSaver]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10.25 items-stretch justify-between border-b bg-muted/30">
        <span className="flex items-center px-3 font-mono text-xs text-muted-foreground">
          {title ?? "config"}
        </span>
        <Button
          type="button"
          disabled={parsed === null}
          className="h-full rounded-none border-0 border-l border-l-border"
          onClick={() => {
            if (parsed !== null) {
              saveNodeConfig(id, parsed);
            }
          }}
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
