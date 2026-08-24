"use client";

import { NAV_ITEMS } from "@/components/dashboard/nav-config";
import { NavLink } from "@/components/dashboard/nav-link";

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
