"use client";

import Link from "next/link";
import { Upload } from "lucide-react";

import { usePermissions } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";

export function ImportCustomersButton() {
  const { hasPermission } = usePermissions();

  if (!hasPermission("imports.manage")) return null;

  return (
    <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/imports" />}>
      <Upload />
      Import
    </Button>
  );
}
