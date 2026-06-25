import CodeMirror from "@uiw/react-codemirror";
import { useEditorExtensions } from "@/components/workspace/use-editor-extensions";

type BodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function BodyEditor({ value, onChange }: BodyEditorProps) {
  const { bodyExtensions } = useEditorExtensions();
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="none"
      extensions={bodyExtensions}
      basicSetup={{ lineNumbers: false }}
      height="100%"
      className="h-full text-xs"
    />
  );
}
