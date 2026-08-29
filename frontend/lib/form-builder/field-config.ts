import {
  Calendar,
  Heading as HeadingIcon,
  Mail,
  MapPin,
  Phone as PhoneIcon,
  SeparatorHorizontal,
  TextCursorInput,
  Type,
  type LucideIcon,
} from "lucide-react";

import type { FieldType, FormField } from "@/lib/form-builder/types";

interface FieldDefinition {
  label: string;
  icon: LucideIcon;
  /** Starting properties a freshly-added field of this type gets. */
  defaultField: Omit<FormField, "id">;
}

/** One entry per field in the left sidebar — label/icon for the picker, and
 * the starting properties a freshly-added field gets. */
export const FIELD_DEFINITIONS: Record<FieldType, FieldDefinition> = {
  heading: {
    label: "Heading",
    icon: HeadingIcon,
    defaultField: { type: "heading", label: "Your Heading Here", align: "left", size: "md" },
  },
  paragraph: {
    label: "Paragraph",
    icon: Type,
    defaultField: { type: "paragraph", label: "Add your paragraph text here." },
  },
  text: {
    label: "Text Input",
    icon: TextCursorInput,
    defaultField: { type: "text", label: "Text Field", placeholder: "", required: false },
  },
  email: {
    label: "Email",
    icon: Mail,
    defaultField: { type: "email", label: "Email Address", placeholder: "you@example.com", required: false },
  },
  phone: {
    label: "Phone",
    icon: PhoneIcon,
    defaultField: { type: "phone", label: "Phone Number", placeholder: "+8801XXXXXXXXX", required: false },
  },
  date_of_birth: {
    label: "Date of Birth",
    icon: Calendar,
    defaultField: { type: "date_of_birth", label: "Date of Birth", required: false },
  },
  address: {
    label: "Address",
    icon: MapPin,
    defaultField: { type: "address", label: "Address", placeholder: "Street, city, postcode", required: false },
  },
  divider: {
    label: "Divider",
    icon: SeparatorHorizontal,
    defaultField: { type: "divider", label: "" },
  },
};
