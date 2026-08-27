import { FormBuilder } from "@/components/form-builder/FormBuilder";

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormBuilder formId={id} />;
}
