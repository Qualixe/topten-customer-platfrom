import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { NewFormForm } from "@/components/dashboard/forms/new-form-form";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafe } from "@/lib/api/auth";

function NewFormHeader() {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href="/dashboard/forms" aria-label="Back to forms" />}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Create Form</h2>
        <p className="text-sm text-muted-foreground">Give your form a name to start building it.</p>
      </div>
    </div>
  );
}

export default async function NewFormPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("forms.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <NewFormHeader />
        <PermissionDenied description="Ask an admin to grant you the Manage forms permission if you think this is a mistake." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <NewFormHeader />
      <NewFormForm />
    </div>
  );
}
