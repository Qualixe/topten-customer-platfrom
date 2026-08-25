import {
  LayoutDashboard,
  Users,
  Upload,
  Megaphone,
  Cake,
  Crown,
  Gift,
  Truck,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the current user's role has this permission. Omitted
   * entirely for items with no real backend gate behind them yet. */
  permission?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", href: "/dashboard/customers", icon: Users, permission: "customers.view" },
  { title: "Imports", href: "/dashboard/imports", icon: Upload, permission: "imports.manage" },
  { title: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone, permission: "campaigns.view" },
  { title: "Birthdays", href: "/dashboard/birthdays", icon: Cake },
  { title: "VIP Customers", href: "/dashboard/vip-customers", icon: Crown },
  { title: "Gifts", href: "/dashboard/gifts", icon: Gift },
  { title: "Couriers", href: "/dashboard/couriers", icon: Truck },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
