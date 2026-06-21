import CodeMirror from "@uiw/react-codemirror";
import { jsonViewerExtensions } from "@/components/workspace/editor-theme";

function prettify(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function JsonViewer({ text }: { text: string }) {
  return (
    <CodeMirror
      value={prettify(text)}
      theme="none"
      editable={false}
      extensions={jsonViewerExtensions}
      basicSetup={{ lineNumbers: false, foldGutter: true }}
      height="100%"
      className="h-full text-xs"
    />
  );
}
