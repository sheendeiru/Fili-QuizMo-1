"use client";

import { useEffect, useRef, useState } from "react";
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
  stickyFirstColumn = false,
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
  /**
   * Keep the first column (the name) in view while the rest scrolls sideways,
   * so every row stays identifiable on a narrow screen.
   */
  stickyFirstColumn?: boolean;
}) {
  // Wide tables scroll sideways inside their own box. Track whether this one
  // actually overflows so the keyboard can reach it and a hint can be shown.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;

    const check = () => setCanScroll(box.scrollWidth > box.clientWidth + 1);
    check();

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    observer?.observe(box);
    if (box.firstElementChild) observer?.observe(box.firstElementChild);
    window.addEventListener("resize", check);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [rows, columns.length]);

  const validPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
  const showPageSize =
    pageSize !== undefined &&
    pageSizeOptions !== undefined &&
    pageSizeOptions.length > 1 &&
    onPageSizeChange !== undefined;

  return (
    <div className="space-y-2 sm:space-y-3">
      <div
        ref={scrollRef}
        role="region"
        aria-label={`${caption}${canScroll ? " (scrolls sideways)" : ""}`}
        tabIndex={canScroll ? 0 : undefined}
        className="w-full max-w-full overflow-x-auto overscroll-x-contain border-2 border-ink bg-surface shadow-[3px_3px_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [-webkit-overflow-scrolling:touch]"
      >
        {/* w-max lets the table be as wide as its columns need; the box above
            scrolls instead of squeezing or clipping them. */}
        <PixelTable className="w-max min-w-full border-0 text-xs! shadow-none sm:text-sm!">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-neutral-100">
            <tr>
              {columns.map((column, columnIndex) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-2 py-1.5 font-bold sm:px-3 sm:py-2 ${
                    stickyFirstColumn && columnIndex === 0
                      ? "sticky left-0 z-[1] border-r border-neutral-300 bg-neutral-100"
                      : ""
                  } ${column.className ?? ""}`}
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
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.key}
                      className={`px-2 py-1.5 align-middle sm:px-3 sm:py-2 ${
                        stickyFirstColumn && columnIndex === 0
                          ? "sticky left-0 z-[1] border-r border-neutral-300 bg-surface"
                          : ""
                      } ${column.className ?? ""}`}
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
      {canScroll ? (
        <p className="text-xs text-neutral-700 sm:text-sm">
          <span aria-hidden="true">↔ </span>
          Scroll sideways to see all columns.
        </p>
      ) : null}
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
