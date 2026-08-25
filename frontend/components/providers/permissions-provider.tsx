"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { AuthUser } from "@/lib/api/auth";

interface PermissionsContextValue {
  user: AuthUser | null;
  hasPermission: (key: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  user: null,
  hasPermission: () => false,
});

/**
 * Seeded server-side (see `app/dashboard/layout.tsx`) with the same
 * `getCurrentUserSafe()` call `Header` already makes — no extra client
 * fetch. This is a UX layer only: it decides what to *show*, not what's
 * *allowed*. The backend independently enforces every permission on every
 * request regardless of what this renders.
 */
export function PermissionsProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: ReactNode;
}) {
  const value = useMemo<PermissionsContextValue>(
    () => ({
      user,
      hasPermission: (key: string) => user?.permissions.includes(key) ?? false,
    }),
    [user]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsContextValue {
  return useContext(PermissionsContext);
}
