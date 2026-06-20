import { json, jsonParseLinter } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Diagnostic } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";

// JetBrains Darcula token colors (IntelliJ default dark). Chrome (background,
// gutter, active line) stays transparent so the editor inherits the pane behind
// it - the request body editor and the response viewer share this scheme.
const darcula = {
  caret: "#bbbbbb",
  selection: "#214283",
  gutterForeground: "#606366",
  keyword: "#cc7832",
  string: "#6a8759",
  number: "#6897bb",
  property: "#9876aa",
  comment: "#808080",
  invalid: "#bc3f3c",
};

export const darculaChrome = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      height: "100%",
    },
    ".cm-content": { caretColor: darcula.caret },
    "&.cm-focused": { outline: "none" },
    "&.cm-focused .cm-cursor": { borderLeftColor: darcula.caret },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: darcula.selection },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: darcula.gutterForeground,
      border: "none",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
    },
  },
  { dark: true },
);

export const darculaHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.bool, t.null], color: darcula.keyword },
  { tag: [t.string, t.special(t.string)], color: darcula.string },
  { tag: [t.number], color: darcula.number },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: darcula.property },
  { tag: [t.comment], color: darcula.comment, fontStyle: "italic" },
  { tag: [t.invalid], color: darcula.invalid },
]);

// jsonParseLinter flags an empty document as "Unexpected EOF". An empty request
// body is a valid state (no body), so suppress diagnostics until something is typed.
export function emptyTolerantJsonLinter(): (view: EditorView) => Diagnostic[] {
  const lint = jsonParseLinter();
  return (view) =>
    view.state.doc.toString().trim() === "" ? [] : lint(view);
}

// Read-only JSON viewer extensions (no editing, no linter, no bracket-closing) -
// same colors as the editor so the response reads like the request body.
export const jsonViewerExtensions = [
  json(),
  EditorView.editable.of(false),
  darculaChrome,
  syntaxHighlighting(darculaHighlight),
];
