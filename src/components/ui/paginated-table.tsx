"use client";

import type { ReactNode } from "react";
import { PixelButton } from "./pixel-primitives";
import { PixelTable } from "./pixel-primitives";

export type PaginatedTableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export function PaginatedTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  page,
  totalPages,
  onPageChange,
  emptyMessage,
}: {
  caption: string;
  columns: readonly PaginatedTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyMessage: string;
}) {
  const validPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border-2 border-ink bg-surface shadow-[3px_3px_0_var(--color-ink)]">
        <PixelTable className="min-w-full border-0 shadow-none">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-neutral-100">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 font-bold ${column.className ?? ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-neutral-200">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 align-middle ${column.className ?? ""}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  className="px-3 py-6 text-center"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </PixelTable>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-sm">
          Page {validPage} of {Math.max(totalPages, 1)}
        </p>
        <div className="flex gap-2">
          <PixelButton
            type="button"
            variant="neutral"
            size="sm"
            onClick={() => onPageChange(validPage - 1)}
            disabled={validPage <= 1}
          >
            Prev
          </PixelButton>
          <PixelButton
            type="button"
            variant="neutral"
            size="sm"
            onClick={() => onPageChange(validPage + 1)}
            disabled={validPage >= totalPages}
          >
            Next
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
