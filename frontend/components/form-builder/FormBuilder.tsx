"use client";

import { FileWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FormCanvas } from "@/components/form-builder/FormCanvas";
import { FormPreview } from "@/components/form-builder/FormPreview";
import { FormProperties } from "@/components/form-builder/FormProperties";
import { FormSidebar } from "@/components/form-builder/FormSidebar";
import { FormToolbar } from "@/components/form-builder/FormToolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIELD_DEFINITIONS } from "@/lib/form-builder/field-config";
import { getForm, updateForm } from "@/lib/form-builder/storage";
import type { FieldType, FormField, FormRecord } from "@/lib/form-builder/types";

function newField(type: FieldType): FormField {
  return { id: crypto.randomUUID(), ...FIELD_DEFINITIONS[type].defaultField };
}

/** Owns all builder state (fields, selection, preview, save status) for one
 * form. Page settings live here too since Save needs the name + fields at
 * once. Loads/saves through lib/form-builder/storage.ts (localStorage) —
 * there is no backend for forms yet. */
export function FormBuilder({ formId }: { formId: string }) {
  const router = useRouter();

  // undefined = still loading, null = not found
  const [form, setForm] = useState<FormRecord | null | undefined>(undefined);
  const [fields, setFields] = useState<FormField[]>([]);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");

  useEffect(() => {
    const loaded = getForm(formId);
    setForm(loaded);
    if (loaded) {
      setFields(loaded.data.fields);
      setName(loaded.name);
    }
  }, [formId]);

  function markUnsaved() {
    setSaveStatus("unsaved");
  }

  const selectedField = fields.find((field) => field.id === selectedId) ?? null;

  function handleAddField(type: FieldType) {
    const field = newField(type);
    setFields((prev) => [...prev, field]);
    setSelectedId(field.id);
    markUnsaved();
  }

  function handleInsertBefore(type: FieldType, beforeId: string) {
    const field = newField(type);
    setFields((prev) => {
      const index = prev.findIndex((existing) => existing.id === beforeId);
      if (index === -1) return [...prev, field];
      const next = [...prev];
      next.splice(index, 0, field);
      return next;
    });
    setSelectedId(field.id);
    markUnsaved();
  }

  function handleReorder(fromId: string, toId: string) {
    setFields((prev) => {
      const fromIndex = prev.findIndex((field) => field.id === fromId);
      const toIndex = prev.findIndex((field) => field.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    markUnsaved();
  }

  function handleDelete(id: string) {
    setFields((prev) => prev.filter((field) => field.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    markUnsaved();
  }

  function handleDuplicate(id: string) {
    setFields((prev) => {
      const index = prev.findIndex((field) => field.id === id);
      if (index === -1) return prev;
      const copy: FormField = { ...prev[index], id: crypto.randomUUID() };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    markUnsaved();
  }

  function handlePropertyChange(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((field) => (field.id === id ? { ...field, ...patch } : field)));
    markUnsaved();
  }

  function handleNameChange(value: string) {
    setName(value);
    markUnsaved();
  }

  function handleSave() {
    setSaveStatus("saving");
    const updated = updateForm(formId, { name, data: { version: 1, fields } });
    if (updated) setForm(updated);
    setSaveStatus("saved");
  }

  if (form === undefined) {
    return null;
  }

  if (form === null) {
    return (
      <EmptyState
        icon={FileWarning}
        title="Form not found"
        description="This form may have been deleted."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormToolbar
        name={name}
        onNameChange={handleNameChange}
        saveStatus={saveStatus}
        onSave={handleSave}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode((prev) => !prev)}
        onBack={() => router.push("/dashboard/forms")}
      />

      {previewMode ? (
        <FormPreview fields={fields} />
      ) : (
        <>
          {/* Desktop: all three columns side by side. */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-[240px_1fr_300px]">
            <FormSidebar onAddField={handleAddField} />
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              <FormCanvas
                fields={fields}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onInsertNewFieldBefore={handleInsertBefore}
                onReorder={handleReorder}
                onAppendNewField={handleAddField}
              />
            </div>
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              <FormProperties field={selectedField} onChange={handlePropertyChange} onDelete={handleDelete} />
            </div>
          </div>

          {/* Tablet/mobile: one panel at a time via tabs. */}
          <Tabs defaultValue="canvas" className="lg:hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>
            <TabsContent value="fields">
              <FormSidebar onAddField={handleAddField} />
            </TabsContent>
            <TabsContent value="canvas">
              <FormCanvas
                fields={fields}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onInsertNewFieldBefore={handleInsertBefore}
                onReorder={handleReorder}
                onAppendNewField={handleAddField}
              />
            </TabsContent>
            <TabsContent value="properties">
              <FormProperties field={selectedField} onChange={handlePropertyChange} onDelete={handleDelete} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
