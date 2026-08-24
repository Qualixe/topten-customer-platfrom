"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CustomersToolbar } from "@/components/dashboard/customers/customers-toolbar";
import {
  buildCustomersHref,
  type CustomersUrlParams,
} from "@/components/dashboard/customers/customers-url";

const SEARCH_DEBOUNCE_MS = 400;

/**
 * The always-visible search/filter controls for the customers page. Kept
 * outside the results' Suspense boundary so it never unmounts (and the
 * search input never loses focus) while a new page of results streams in.
 */
export function CustomersFilterBar({
  current,
}: {
  current: CustomersUrlParams;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(current.search);
  const [syncedSearch, setSyncedSearch] = useState(current.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync with the URL when it changes externally (e.g.
  // browser back/forward), without re-syncing on every render — adjusting
  // state during render (rather than in an effect) avoids the extra
  // commit an effect-based sync would cause. See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (current.search !== syncedSearch) {
    setSyncedSearch(current.search);
    setSearchValue(current.search);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function navigate(patch: Partial<CustomersUrlParams>) {
    router.push(buildCustomersHref(current, patch));
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value });
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <CustomersToolbar
      search={searchValue}
      onSearchChange={handleSearchChange}
      tierFilter={current.tier}
      onTierFilterChange={(value) => navigate({ tier: value })}
      statusFilter={current.status}
      onStatusFilterChange={(value) => navigate({ status: value })}
      customerTypeFilter={current.customerType}
      onCustomerTypeFilterChange={(value) => navigate({ customerType: value })}
    />
  );
}
