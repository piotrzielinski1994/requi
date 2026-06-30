import {
  EditableKeyValueTable,
  type TokenHighlightContext,
} from "@/components/workspace/editable-key-value-table";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { extractPathParams } from "@/lib/http/path-params";
import type { RequestNode } from "@/lib/workspace/model";

// Path params are a request-only key->value grid (editable keys + values, like
// VarsPanel - no enable toggle). Rows are the union of the `:name` tokens in the
// URL (so a param typed into the address bar shows up) and the stored `pathParams`
// keys (so a param defined here ahead of the URL shows up too). URL names come
// first (first-appearance order), then any grid-only keys.
export function PathParamsPanel({
  request,
  highlight,
}: {
  request: RequestNode;
  highlight?: TokenHighlightContext;
}) {
  const { setRequestPathParams } = useWorkspace();
  const values = request.pathParams ?? {};
  const urlNames = extractPathParams(request.url);
  const extraKeys = Object.keys(values).filter(
    (key) => !urlNames.includes(key),
  );
  const rows = [...urlNames, ...extraKeys].map((key) => ({
    key,
    value: values[key] ?? "",
  }));

  return (
    <EditableKeyValueTable
      rows={rows}
      highlight={highlight}
      onChange={(next) =>
        setRequestPathParams(
          request.id,
          Object.fromEntries(next.map((row) => [row.key, row.value])),
        )
      }
    />
  );
}
