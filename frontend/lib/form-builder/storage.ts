import type { FormBuilderData, FormRecord } from "@/lib/form-builder/types";

/**
 * Frontend-only persistence for the Form Builder. There is no backend for
 * forms yet, so the form list and each form's fields live in the browser's
 * localStorage — this lets state survive navigating between the forms
 * list, the "new form" page, and the builder, without a server. Swapping
 * this for real API calls later should only require rewriting this file.
 */

const STORAGE_KEY = "topten_form_builder_forms_v1";

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function seedForms(): FormRecord[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Customer Information",
      description: "Basic profile details collected after a purchase.",
      status: "PUBLISHED",
      updatedAt: daysAgo(0),
      data: {
        version: 1,
        fields: [
          { id: crypto.randomUUID(), type: "heading", label: "Complete Your Profile", align: "left", size: "md" },
          { id: crypto.randomUUID(), type: "date_of_birth", label: "Date of Birth", required: true },
          { id: crypto.randomUUID(), type: "address", label: "Address", placeholder: "Street, city, postcode", required: true },
          { id: crypto.randomUUID(), type: "email", label: "Email Address", placeholder: "you@example.com", required: false },
          { id: crypto.randomUUID(), type: "submit_button", label: "Save my details" },
        ],
      },
    },
    {
      id: crypto.randomUUID(),
      name: "VIP Profile",
      description: "Extra details collected from VIP customers.",
      status: "DRAFT",
      updatedAt: daysAgo(1),
      data: { version: 1, fields: [] },
    },
    {
      id: crypto.randomUUID(),
      name: "Birthday Form",
      description: "Collects date of birth for birthday campaigns.",
      status: "DRAFT",
      updatedAt: daysAgo(6),
      data: { version: 1, fields: [] },
    },
  ];
}

function readAll(): FormRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedForms();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as FormRecord[];
  } catch {
    return seedForms();
  }
}

function writeAll(forms: FormRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(forms));
  } catch {
    // Storage unavailable (private browsing, quota full) — edits just
    // won't persist across a reload, which is acceptable for mock data.
  }
}

export function getForms(): FormRecord[] {
  return readAll();
}

export function getForm(id: string): FormRecord | null {
  return readAll().find((form) => form.id === id) ?? null;
}

export function createForm(name: string, description: string): FormRecord {
  const newForm: FormRecord = {
    id: crypto.randomUUID(),
    name,
    description,
    status: "DRAFT",
    updatedAt: new Date().toISOString(),
    data: { version: 1, fields: [] },
  };
  writeAll([newForm, ...readAll()]);
  return newForm;
}

export function updateForm(
  id: string,
  patch: Partial<{ name: string; description: string; status: FormRecord["status"]; data: FormBuilderData }>
): FormRecord | null {
  const forms = readAll();
  const index = forms.findIndex((form) => form.id === id);
  if (index === -1) return null;

  const updated: FormRecord = { ...forms[index], ...patch, updatedAt: new Date().toISOString() };
  forms[index] = updated;
  writeAll(forms);
  return updated;
}

export function deleteForm(id: string): void {
  writeAll(readAll().filter((form) => form.id !== id));
}

export function duplicateForm(id: string): FormRecord | null {
  const original = getForm(id);
  if (!original) return null;

  const copy: FormRecord = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} Copy`,
    status: "DRAFT",
    updatedAt: new Date().toISOString(),
    data: {
      version: 1,
      fields: original.data.fields.map((field) => ({ ...field, id: crypto.randomUUID() })),
    },
  };
  writeAll([copy, ...readAll()]);
  return copy;
}
