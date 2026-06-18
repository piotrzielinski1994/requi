import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

export type DemoRow = {
  id: string;
  method: string;
  name: string;
};

const PLACEHOLDER_ROWS: DemoRow[] = [
  { id: "1", method: "GET", name: "List users" },
  { id: "2", method: "POST", name: "Create user" },
  { id: "3", method: "DELETE", name: "Remove user" },
];

const columnHelper = createColumnHelper<DemoRow>();

const columns = [
  columnHelper.accessor("method", { header: "Method" }),
  columnHelper.accessor("name", { header: "Name" }),
];

export function DemoTable({ rows = PLACEHOLDER_ROWS }: { rows?: DemoRow[] }) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasRows = table.getRowModel().rows.length > 0;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-b text-left">
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="py-2 pr-4 font-medium">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {!hasRows ? (
          <tr>
            <td
              colSpan={columns.length}
              className="py-4 text-center text-muted-foreground"
            >
              No requests yet.
            </td>
          </tr>
        ) : (
          table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-2 pr-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
