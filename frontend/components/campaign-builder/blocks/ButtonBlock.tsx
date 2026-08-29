import { Button } from "@/components/ui/button";
import type { Block } from "@/components/campaign-builder/types";

/** A button block is dual-purpose, decided by whether the admin set a link
 * URL: with a URL it's a real link (e.g. "View our privacy policy") and
 * must never submit the form; without one, on the real public form, it IS
 * the submit action (see BlockRenderer) — in the builder/its own Preview
 * it's always just a static, non-functional preview either way. */
export function ButtonBlock({
  block,
  type = "button",
  disabled = false,
}: {
  block: Block;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const text = block.content.text || "Button";
  const url = block.content.url?.trim();

  if (url) {
    return (
      <Button
        nativeButton={false}
        disabled={disabled}
        render={<a href={url} target="_blank" rel="noopener noreferrer" />}
      >
        {text}
      </Button>
    );
  }

  return (
    <Button type={type} disabled={disabled} className={type === "submit" ? "h-12 w-full text-base" : undefined}>
      {text}
    </Button>
  );
}
