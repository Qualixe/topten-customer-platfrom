import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// The builder (drag-and-drop fields, live preview) is a big client-only
// bundle used on this one route — code-split so every other page never
// pays for it.
const FormBuilder = dynamic(
  () => import("@/components/form-builder/FormBuilder").then((m) => m.FormBuilder),
  { loading: () => <Skeleton className="h-[calc(100vh-8rem)] w-full" /> }
);

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormBuilder formId={id} />;
}
