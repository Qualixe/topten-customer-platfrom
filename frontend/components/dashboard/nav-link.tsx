"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/dashboard/nav-config";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const EXPANDED_STORAGE_KEY = "topten:sidebar-expanded";

/** Per-tab, not just per-component-instance — the dashboard layout's
 * server-rendered subtree gets re-created on every navigation (it isn't a
 * static shell), which remounts every NavLink and would otherwise reset a
 * manually expanded item back to collapsed the moment you navigate away
 * from it. Reading/writing sessionStorage lets a user's explicit
 * expand/collapse choice survive that remount. */
function readStoredExpanded(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeStoredExpanded(href: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    const current = readStoredExpanded();
    current[href] = value;
    sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private browsing / storage disabled / quota — expand choice just
    // won't survive navigation in that case, nothing else breaks.
  }
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
  const hasChildren = !!item.children && item.children.length > 0;
  const childActive = hasChildren && item.children!.some((child) => pathname === child.href);

  // null = no explicit user choice yet for this item, in this tab — falls
  // back to auto-expanding only while this section is the active one.
  const [manuallyExpanded, setManuallyExpanded] = useState<boolean | null>(
    () => readStoredExpanded()[item.href] ?? null
  );

  // Collapse when the user navigates away from this section entirely.
  // active/childActive going false means neither this item nor any of its
  // children is the current route — clear the manual override so the item
  // returns to its default collapsed state.
  const isInSection = active || childActive;
  const expanded = isInSection || manuallyExpanded === true;

  // When we're no longer in this section but still have a stored "open"
  // override, clear it so it doesn't re-expand on the next remount.
  if (!isInSection && manuallyExpanded === true) {
    setManuallyExpanded(null);
    writeStoredExpanded(item.href, false);
  }

  const Icon = item.icon;

  function setExpanded(next: boolean) {
    setManuallyExpanded(next);
    writeStoredExpanded(item.href, next);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "group flex items-center rounded-lg text-sm font-medium transition-all duration-150",
          active
            ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_var(--primary)]"
            : "text-sidebar-foreground hover:translate-x-0.5 hover:bg-primary/10 hover:text-primary"
        )}
      >
        <Link
          href={item.href}
          onClick={() => {
            if (hasChildren) setExpanded(true);
            onNavigate?.();
          }}
          aria-current={active ? "page" : undefined}
          className="flex flex-1 items-center gap-3 py-2.5 pl-4"
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

        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
            className={cn(
              "mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
              active ? "hover:bg-primary-foreground/15" : "hover:bg-primary/15"
            )}
          >
            {expanded ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
          </button>
        )}

        {!hasChildren && <span className="w-4 shrink-0" aria-hidden="true" />}
      </div>

      {hasChildren && expanded && (
        <div className="ml-6 flex flex-col gap-0.5 border-l border-border pl-4">
          {item.children!.map((child) => {
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
                    : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground"
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
