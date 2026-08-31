"use client";

import { NAV_ITEMS, type NavSection } from "@/components/dashboard/nav-config";
import { NavLink } from "@/components/dashboard/nav-link";
import { usePermissions } from "@/components/providers/permissions-provider";

const SECTION_ORDER: NavSection[] = ["Overview", "Audience", "Messaging", "Workspace"];

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

  const sections = SECTION_ORDER.map((section) => ({
    section,
    items: items.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Main" className="flex flex-col gap-4 p-3">
      {sections.map(({ section, items: sectionItems }) => (
        <div key={section} className="flex flex-col gap-1">
          <span className="px-3 text-xs font-medium tracking-wide text-sidebar-foreground/60">
            {section}
          </span>
          {sectionItems.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
