"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { PaginationBar } from "@/components/dashboard/customers/pagination-bar";

export function PosCustomersPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handlePageChange(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    router.push(`/dashboard/customers/pos?${params.toString()}`);
  }

  return (
    <PaginationBar
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={pageSize}
      onPageChange={handlePageChange}
    />
  );
}
