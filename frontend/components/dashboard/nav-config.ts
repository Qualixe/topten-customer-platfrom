import {
  LayoutDashboard,
  Users,
  Upload,
  Megaphone,
  Cake,
  Crown,
  Gift,
  FileText,
  Truck,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavChildItem = {
  title: string;
  href: string;
  /** Hidden unless the current user's role has this permission. */
  permission?: string;
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the current user's role has this permission. Omitted
   * entirely for items with no real backend gate behind them yet. */
  permission?: string;
  /** Sub-links shown indented beneath this item, e.g. a quick "Add" shortcut. */
  children?: NavChildItem[];
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    permission: "customers.view",
    children: [
      { title: "POS Customers", href: "/dashboard/customers/pos" },
      { title: "Verified Customers", href: "/dashboard/customers/verified" },
    ],
  },
  { title: "Imports", href: "/dashboard/imports", icon: Upload, permission: "imports.manage" },
  { title: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone, permission: "campaigns.view" },
  { title: "Forms", href: "/dashboard/forms", icon: FileText, permission: "forms.view" },
  { title: "Birthdays", href: "/dashboard/birthdays", icon: Cake, permission: "customers.view" },
  {
    title: "VIP Customers",
    href: "/dashboard/vip-customers",
    icon: Crown,
    permission: "customers.view",
  },
  {
    title: "Gifts",
    href: "/dashboard/gifts",
    icon: Gift,
    permission: "gifts.view",
    children: [
      { title: "Gift Catalog", href: "/dashboard/gifts/catalog" },
      { title: "Send Gift", href: "/dashboard/gifts/send", permission: "gifts.manage" },
      { title: "Add Gift", href: "/dashboard/gifts/new", permission: "gifts.manage" },
    ],
  },
  { title: "Couriers", href: "/dashboard/couriers", icon: Truck },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
