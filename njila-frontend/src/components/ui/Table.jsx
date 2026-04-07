import { cn } from "../../utils/cn";
import Spinner from "./Spinner";

export default function Table({
  columns = [],   // [{ key, label, width?, align?, render? }]
  data    = [],
  isLoading = false,
  emptyMessage = "Aucune donnée disponible",
  className = "",
  onRowClick,
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {columns.map(col => (
                <th key={col.key}
                  className={cn(
                    "px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider",
                    col.align === "right"  && "text-right",
                    col.align === "center" && "text-center",
                    col.width && `w-${col.width}`
                  )}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <Spinner size="md" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-slate-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-slate-50 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-slate-50"
                  )}
                >
                  {columns.map(col => (
                    <td key={col.key}
                      className={cn(
                        "px-5 py-4 text-sm text-slate-700",
                        col.align === "right"  && "text-right",
                        col.align === "center" && "text-center"
                      )}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
