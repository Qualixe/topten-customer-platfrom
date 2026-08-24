"use client";

import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/dashboard/nav-config";

function getPageTitle(pathname: string) {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return match?.title ?? "Dashboard";
}

export function PageTitle() {
  const pathname = usePathname();

  return (
    <h1 className="truncate text-base font-semibold tracking-tight">
      {getPageTitle(pathname)}
    </h1>
  );
}
