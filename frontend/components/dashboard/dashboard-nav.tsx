"use client";

import { NAV_ITEMS } from "@/components/dashboard/nav-config";
import { NavLink } from "@/components/dashboard/nav-link";
import { usePermissions } from "@/components/providers/permissions-provider";

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPermission } = usePermissions();
  const items = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission)).map(
    (item) => ({
      ...item,
      children: item.children?.filter(
        (child) => !child.permission || hasPermission(child.permission)
      ),
    })
  );

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      {items.map((item) => (
        <NavLink key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
