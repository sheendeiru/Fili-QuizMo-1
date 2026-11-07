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
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  caption: string;
  columns: readonly PaginatedTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyMessage: string;
  /**
   * Optional "Rows" selector. The table only draws the control: the parent
   * decides what a page size means (server query, client slice, ...).
   * Nothing changes until all three props are passed.
   */
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
}) {
  const validPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
  const showPageSize =
    pageSize !== undefined &&
    pageSizeOptions !== undefined &&
    pageSizeOptions.length > 1 &&
    onPageSizeChange !== undefined;

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="overflow-x-auto border-2 border-ink bg-surface shadow-[3px_3px_0_var(--color-ink)]">
        <PixelTable className="min-w-full border-0 text-xs! shadow-none sm:text-sm!">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-neutral-100">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-2 py-1.5 font-bold sm:px-3 sm:py-2 ${column.className ?? ""}`}
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
                      className={`px-2 py-1.5 align-middle sm:px-3 sm:py-2 ${column.className ?? ""}`}
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
                  className="px-3 py-4 text-center"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </PixelTable>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-xs sm:text-sm">
          Page {validPage} of {Math.max(totalPages, 1)}
        </p>
        <div className="flex items-center gap-2">
          {showPageSize ? (
            <>
              <label htmlFor="table-page-size" className="sr-only">
                Rows per page
              </label>
              <select
                id="table-page-size"
                value={pageSize}
                onChange={(event) =>
                  onPageSizeChange(Number(event.currentTarget.value))
                }
                className="pixel-input h-9 px-2 text-xs sm:text-sm"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} rows
                  </option>
                ))}
              </select>
            </>
          ) : null}
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
