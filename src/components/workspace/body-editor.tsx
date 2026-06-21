import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { closeBrackets } from "@codemirror/autocomplete";
import { syntaxHighlighting } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import {
  darculaChrome,
  darculaHighlight,
  emptyTolerantJsonLinter,
} from "@/components/workspace/editor-theme";

const extensions = [
  json(),
  closeBrackets(),
  linter(emptyTolerantJsonLinter()),
  darculaChrome,
  syntaxHighlighting(darculaHighlight),
];

type BodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function BodyEditor({ value, onChange }: BodyEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="none"
      extensions={extensions}
      basicSetup={{ lineNumbers: false }}
      height="100%"
      className="h-full text-xs"
    />
  );
}
