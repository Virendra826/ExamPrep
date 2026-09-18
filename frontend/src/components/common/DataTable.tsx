import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (newPage: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No items found.",
  keyExtractor,
  pagination,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Loading records...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
          <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 tracking-wider">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={`px-6 py-4 ${col.headerClassName || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-transparent">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-14 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                    <Inbox className="w-10 h-10 text-slate-600 mb-1" />
                    <p className="text-sm font-medium text-slate-300">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {columns.map((col, idx) => (
                    <td
                      key={idx}
                      className={`px-6 py-4 whitespace-nowrap ${col.className || ""}`}
                    >
                      {col.render
                        ? col.render(item)
                        : col.accessor
                        ? String(item[col.accessor] ?? "")
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
          <div>
            Showing page <span className="font-semibold text-white">{pagination.page}</span> of{" "}
            <span className="font-semibold text-white">{pagination.totalPages}</span> (
            <span className="font-semibold text-white">{pagination.total}</span> total)
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
