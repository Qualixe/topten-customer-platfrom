import type { MouseEvent } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

function getPageWindow(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const withEllipsis: (number | "ellipsis")[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) {
      withEllipsis.push("ellipsis");
    }
    withEllipsis.push(p);
  });

  return withEllipsis;
}

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);
  const pageWindow = getPageWindow(page, totalPages);

  const goTo = (target: number) => (event: MouseEvent) => {
    event.preventDefault();
    if (target >= 1 && target <= totalPages) onPageChange(target);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {totalItems === 0
          ? "No customers found"
          : `Showing ${rangeStart}-${rangeEnd} of ${totalItems} customers`}
      </p>
      {totalPages > 1 && (
        <Pagination className="mx-0 w-fit">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={goTo(page - 1)}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            {pageWindow.map((entry, index) =>
              entry === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <PaginationLink
                    href="#"
                    isActive={entry === page}
                    onClick={goTo(entry)}
                  >
                    {entry}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={goTo(page + 1)}
                aria-disabled={page === totalPages}
                className={
                  page === totalPages ? "pointer-events-none opacity-50" : undefined
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
