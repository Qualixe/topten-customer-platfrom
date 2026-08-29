"use client";

import { FileWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AttachToCampaignDialog } from "@/components/dashboard/forms/attach-to-campaign-dialog";
import { FormCanvas } from "@/components/form-builder/FormCanvas";
import { FormPreview } from "@/components/form-builder/FormPreview";
import { FormProperties } from "@/components/form-builder/FormProperties";
import { FormSidebar } from "@/components/form-builder/FormSidebar";
import { FormToolbar } from "@/components/form-builder/FormToolbar";
import { usePermissions } from "@/components/providers/permissions-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getForm, updateForm, type FormRecord } from "@/lib/api/forms";
import { ApiError, getErrorMessage } from "@/lib/api/types";
import { FIELD_DEFINITIONS } from "@/lib/form-builder/field-config";
import type { FieldType, FormField } from "@/lib/form-builder/types";

function newField(type: FieldType): FormField {
  return { id: crypto.randomUUID(), ...FIELD_DEFINITIONS[type].defaultField };
}

/** Owns all builder state (fields, selection, preview, save status) for one
 * form. Page settings live here too since Save needs the name + fields at
 * once. Loads/saves through lib/api/forms.ts (a real backend). */
export function FormBuilder({ formId }: { formId: string }) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("forms.manage");

  // undefined = still loading, null = not found
  const [form, setForm] = useState<FormRecord | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getForm(formId)
      .then((loaded) => {
        setForm(loaded);
        setFields(loaded.builderData.fields);
        setName(loaded.name);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setForm(null);
          return;
        }
        setLoadError(getErrorMessage(err, "Unable to load this form. Please try again."));
      });
  }, [formId]);

  // Warn on a hard refresh/tab close with unsaved edits — there's no
  // autosave, so those edits would otherwise vanish silently.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveStatus === "unsaved") event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  function markUnsaved() {
    setSaveStatus("unsaved");
  }

  function handleBack() {
    if (saveStatus === "unsaved" && !window.confirm("You have unsaved changes. Leave without saving?")) {
      return;
    }
    router.push("/dashboard/forms");
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

  async function handleSave() {
    if (!name.trim()) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const updated = await updateForm(formId, { name, builderData: { version: 1, fields } });
      setForm(updated);
      setSaveStatus("saved");
    } catch (err) {
      setSaveError(getErrorMessage(err, "Unable to save this form. Please try again."));
      setSaveStatus("unsaved");
    }
  }

  if (form === undefined) {
    if (loadError) {
      return <EmptyState icon={FileWarning} title="Couldn't load this form" description={loadError} />;
    }
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

  const readOnly = !canManage;
  const canvas = (
    <FormCanvas
      fields={fields}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
      onInsertNewFieldBefore={handleInsertBefore}
      onReorder={handleReorder}
      onAppendNewField={handleAddField}
      readOnly={readOnly}
    />
  );
  const properties = (
    <FormProperties field={selectedField} onChange={handlePropertyChange} onDelete={handleDelete} />
  );
  const sidebar = <FormSidebar onAddField={handleAddField} />;

  return (
    <div className="flex flex-col gap-4">
      <FormToolbar
        name={name}
        onNameChange={handleNameChange}
        saveStatus={saveStatus}
        onSave={handleSave}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode((prev) => !prev)}
        onBack={handleBack}
        canManage={canManage}
        extraAction={<AttachToCampaignDialog formId={formId} />}
      />
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      {previewMode ? (
        <FormPreview fields={fields} />
      ) : canManage ? (
        <>
          {/* Desktop: all three columns side by side. */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-[240px_1fr_300px]">
            {sidebar}
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">{canvas}</div>
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">{properties}</div>
          </div>

          {/* Tablet/mobile: one panel at a time via tabs. */}
          <Tabs defaultValue="canvas" className="lg:hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>
            <TabsContent value="fields">{sidebar}</TabsContent>
            <TabsContent value="canvas">{canvas}</TabsContent>
            <TabsContent value="properties">{properties}</TabsContent>
          </Tabs>
        </>
      ) : (
        // View-only (no forms.manage): just the read-only canvas, no
        // sidebar/properties/tabs since there's nothing to configure.
        canvas
      )}
    </div>
  );
}
