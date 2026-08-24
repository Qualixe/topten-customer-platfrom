"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Brand } from "@/components/dashboard/brand";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({ logoUrl = null }: { logoUrl?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="size-5" aria-hidden="true" />
        <span className="sr-only">Open navigation menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-16 justify-center border-b px-4">
          <SheetTitle className="text-base font-semibold">
            <Brand logoUrl={logoUrl} />
          </SheetTitle>
        </SheetHeader>
        <Separator />
        <ScrollArea className="flex-1">
          <DashboardNav onNavigate={() => setOpen(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
