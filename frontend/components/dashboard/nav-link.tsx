"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/dashboard/nav-config";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <div className="flex flex-col gap-0.5">
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
          active
            ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_var(--primary)]"
            : "text-muted-foreground hover:translate-x-0.5 hover:bg-primary/10 hover:text-primary"
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
            active ? "bg-primary-foreground/15" : "group-hover:bg-primary/10"
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="truncate">{item.title}</span>
      </Link>

      {item.children && item.children.length > 0 && (
        <div className="ml-6 flex flex-col gap-0.5 border-l border-border pl-4">
          {item.children.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "truncate rounded-md px-3 py-1.5 text-sm transition-colors",
                  childActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {child.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
