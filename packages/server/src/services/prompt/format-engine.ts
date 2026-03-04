// ──────────────────────────────────────────────
// Format Engine — XML / Markdown auto-wrapping
// ──────────────────────────────────────────────
import type { WrapFormat } from "@rpg-engine/shared";
import { nameToXmlTag } from "@rpg-engine/shared";

/**
 * Convert a display name to a Markdown heading slug.
 * "World Info (Before)" → "World Info Before"
 */
function nameToMarkdownHeading(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s_-]/g, "").trim();
}

/**
 * Wrap a section's content in the preset's chosen format.
 *
 * XML:      <section_name>\ncontent\n</section_name>
 * Markdown: ## Section Name\ncontent
 *
 * If the content is empty (after trimming), returns empty string.
 */
export function wrapContent(
  content: string,
  sectionName: string,
  format: WrapFormat,
): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  if (format === "xml") {
    const tag = nameToXmlTag(sectionName);
    return `<${tag}>\n${trimmed}\n</${tag}>`;
  }

  // Markdown
  const heading = nameToMarkdownHeading(sectionName);
  return `## ${heading}\n${trimmed}`;
}

/**
 * Wrap a group (container) around multiple children's content.
 *
 * XML:      <group_name>\n...children...\n</group_name>
 * Markdown: # Group Name\n...children...
 */
export function wrapGroup(
  childrenContent: string,
  groupName: string,
  format: WrapFormat,
): string {
  const trimmed = childrenContent.trim();
  if (!trimmed) return "";

  if (format === "xml") {
    const tag = nameToXmlTag(groupName);
    return `<${tag}>\n${trimmed}\n</${tag}>`;
  }

  const heading = nameToMarkdownHeading(groupName);
  return `# ${heading}\n${trimmed}`;
}
