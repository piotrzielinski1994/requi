import CodeMirror from "@uiw/react-codemirror";
import { useEditorExtensions } from "@/components/workspace/use-editor-extensions";

function prettify(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function JsonViewer({ text }: { text: string }) {
  const { viewerExtensions } = useEditorExtensions();
  return (
    <CodeMirror
      value={prettify(text)}
      theme="none"
      editable={false}
      extensions={viewerExtensions}
      basicSetup={{ lineNumbers: false, foldGutter: true }}
      height="100%"
      className="h-full text-xs"
    />
  );
}
