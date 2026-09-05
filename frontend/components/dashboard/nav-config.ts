import {
  LayoutDashboard,
  Users,
  Upload,
  Megaphone,
  Cake,
  Gift,
  FileText,
  ListFilter,
  Truck,
  Bell,
  Settings,
  MessageSquareText,
  BarChart3,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export type NavChildItem = {
  title: string;
  href: string;
  /** Hidden unless the current user's role has this permission. */
  permission?: string;
};

export type NavSection = "Overview" | "Audience" | "Messaging" | "Workspace";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Sidebar group this item is rendered under. */
  section: NavSection;
  /** Hidden unless the current user's role has this permission. Omitted
   * entirely for items with no real backend gate behind them yet. */
  permission?: string;
  /** Sub-links shown indented beneath this item, e.g. a quick "Add" shortcut. */
  children?: NavChildItem[];
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "Overview" },
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3, section: "Overview" },

  {
    title: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    section: "Audience",
    permission: "customers.view",
    children: [
      { title: "POS Customers", href: "/dashboard/customers/pos" },
      { title: "Verified Customers", href: "/dashboard/customers/verified" }
    ],
  },
  {
    title: "Segments",
    href: "/dashboard/segments",
    icon: ListFilter,
    section: "Audience",
    permission: "customers.view",
  },
  { title: "Birthdays", href: "/dashboard/birthdays", icon: Cake, section: "Audience", permission: "customers.view" },
  { title: "Forms", href: "/dashboard/forms", icon: FileText, section: "Audience", permission: "forms.view" },

  { title: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone, section: "Messaging", permission: "campaigns.view" },
  { title: "Templates", href: "/dashboard/templates", icon: MessageSquareText, section: "Messaging", permission: "templates.view" },
  { title: "Marketing", href: "/dashboard/marketing", icon: ShoppingBag, section: "Messaging", permission: "marketing.view" },
  {
    title: "Gifts",
    href: "/dashboard/gifts",
    icon: Gift,
    section: "Messaging",
    permission: "gifts.view",
    children: [
      { title: "Gift Catalog", href: "/dashboard/gifts/catalog" },
      { title: "Send Gift", href: "/dashboard/gifts/send", permission: "gifts.manage" }
    ],
  },
  { title: "Imports", href: "/dashboard/imports", icon: Upload, section: "Workspace", permission: "imports.manage" },
  { title: "Delivery", href: "/dashboard/couriers", icon: Truck, section: "Workspace" },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell, section: "Workspace" },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, section: "Workspace" },
];
