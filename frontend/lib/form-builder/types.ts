export type FieldType =
  | "heading"
  | "paragraph"
  | "text"
  | "email"
  | "phone"
  | "date_of_birth"
  | "address"
  | "divider"
  | "submit_button";

/** A single field on the form. Not every property applies to every type —
 * each field component just reads the ones it cares about (e.g. only
 * "heading" reads `align`/`size`, only "text"/"email"/"phone"/"address"
 * read `placeholder`). Keeping one flat shape (rather than a type per
 * field) mirrors the campaign landing page builder's `Block` shape and
 * keeps the JSON simple. */
export interface FormField {
  id: string;
  type: FieldType;
  /** Doubles as the heading/paragraph/button text for those field types. */
  label: string;
  placeholder?: string;
  required?: boolean;
  /** Heading only. */
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
}

/** The structured JSON a form's fields are stored as — same shape as the
 * campaign landing page builder's `{ version, blocks }`. Persisted as
 * `Form.builderData` — see lib/api/forms.ts for the saved-form record
 * shape (id, name, status, etc.) this nests inside. */
export interface FormBuilderData {
  version: 1;
  fields: FormField[];
}

/** Drag-and-drop MIME types shared between the sidebar (drag source for new
 * fields) and the canvas (drop target for both new fields and reordering). */
export const NEW_FIELD_DRAG_TYPE = "application/x-topten-form-field-type";
export const EXISTING_FIELD_DRAG_TYPE = "application/x-topten-form-field-id";
