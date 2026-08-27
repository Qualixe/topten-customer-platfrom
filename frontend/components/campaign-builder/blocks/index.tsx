import { AddressBlock } from "@/components/campaign-builder/blocks/AddressBlock";
import { ButtonBlock } from "@/components/campaign-builder/blocks/ButtonBlock";
import { DateOfBirthBlock } from "@/components/campaign-builder/blocks/DateOfBirthBlock";
import { DividerBlock } from "@/components/campaign-builder/blocks/DividerBlock";
import { EmailBlock } from "@/components/campaign-builder/blocks/EmailBlock";
import { HeadingBlock } from "@/components/campaign-builder/blocks/HeadingBlock";
import { ImageBlock } from "@/components/campaign-builder/blocks/ImageBlock";
import { SpacerBlock } from "@/components/campaign-builder/blocks/SpacerBlock";
import { TextBlock } from "@/components/campaign-builder/blocks/TextBlock";
import type { Block } from "@/components/campaign-builder/types";

export type FormFieldName = "dateOfBirth" | "address" | "email";

/** Values for the real submission form — only present on the public
 * landing page, where the date_of_birth/address/email blocks become real
 * inputs instead of disabled previews. */
export interface FormValues {
  dateOfBirth: string;
  address: string;
  email: string;
}

/** Picks the right renderer for a block's type. `preview` is passed through
 * to the few block types that look different on the real page (form fields
 * become enabled, the spacer becomes truly blank). `formValues`/
 * `onFormFieldChange` are only passed by the real public page — that's what
 * turns the three form-field blocks from static previews into a working
 * form, without duplicating this switch anywhere else. */
export function BlockRenderer({
  block,
  preview = false,
  formValues,
  onFormFieldChange,
}: {
  block: Block;
  preview?: boolean;
  formValues?: FormValues;
  onFormFieldChange?: (field: FormFieldName, value: string) => void;
}) {
  switch (block.type) {
    case "heading":
      return <HeadingBlock block={block} />;
    case "text":
      return <TextBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "date_of_birth":
      return (
        <DateOfBirthBlock
          block={block}
          preview={preview}
          value={formValues?.dateOfBirth}
          onChange={
            onFormFieldChange ? (value) => onFormFieldChange("dateOfBirth", value) : undefined
          }
        />
      );
    case "address":
      return (
        <AddressBlock
          block={block}
          preview={preview}
          value={formValues?.address}
          onChange={onFormFieldChange ? (value) => onFormFieldChange("address", value) : undefined}
        />
      );
    case "email":
      return (
        <EmailBlock
          block={block}
          preview={preview}
          value={formValues?.email}
          onChange={onFormFieldChange ? (value) => onFormFieldChange("email", value) : undefined}
        />
      );
    case "button":
      return <ButtonBlock block={block} />;
    case "divider":
      return <DividerBlock />;
    case "spacer":
      return <SpacerBlock block={block} preview={preview} />;
    default:
      return null;
  }
}
