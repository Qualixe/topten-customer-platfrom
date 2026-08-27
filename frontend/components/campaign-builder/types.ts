import {
  Calendar,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Mail,
  MapPin,
  MousePointerClick,
  MoveVertical,
  SeparatorHorizontal,
  Type,
  type LucideIcon,
} from "lucide-react";

// Must match the backend's LandingPageBlockType exactly (see
// backend/app/views/campaign_landing_pages.py) — this list is what gets
// saved and validated server-side.
export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "date_of_birth"
  | "address"
  | "email"
  | "button"
  | "divider"
  | "spacer";

/** A single block on the landing page. `content` is a flat string map so
 * every block type can share the same shape — each block component just
 * reads the keys it cares about. */
export interface Block {
  id: string;
  type: BlockType;
  content: Record<string, string>;
}

interface BlockDefinition {
  label: string;
  icon: LucideIcon;
  defaultContent: Record<string, string>;
}

/** One entry per component in the left sidebar — label/icon for the picker,
 * and the starting content a freshly-added block gets. */
export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  heading: {
    label: "Heading",
    icon: HeadingIcon,
    defaultContent: { text: "Your Heading Here" },
  },
  text: {
    label: "Text",
    icon: Type,
    defaultContent: { text: "Add your text content here." },
  },
  image: {
    label: "Image",
    icon: ImageIcon,
    defaultContent: { url: "", alt: "" },
  },
  date_of_birth: {
    label: "Date of Birth",
    icon: Calendar,
    defaultContent: { label: "Date of Birth" },
  },
  address: {
    label: "Address",
    icon: MapPin,
    defaultContent: { label: "Address" },
  },
  email: {
    label: "Email",
    icon: Mail,
    defaultContent: { label: "Email Address" },
  },
  button: {
    label: "Button",
    icon: MousePointerClick,
    defaultContent: { text: "Click Here", url: "" },
  },
  divider: {
    label: "Divider",
    icon: SeparatorHorizontal,
    defaultContent: {},
  },
  spacer: {
    label: "Spacer",
    icon: MoveVertical,
    defaultContent: { height: "40" },
  },
};
