/**
 * Renders a markdown string as safe HTML.
 * Supports: **bold**, *italic*, headings (#), bullet lists (-).
 * No external markdown library needed — simple transform for job descriptions.
 */

type Props = { content: string; className?: string };

export default function MarkdownContent({ content, className }: Props) {
  const html = parseMarkdown(content);
  return (
    <div
      className={`prose-content ${className ?? ''}`}
      // Raw HTML in `content` is escaped by parseMarkdown before any markdown
      // transform runs, so what reaches dangerouslySetInnerHTML contains only
      // the tags this file generates. That holds regardless of where the text
      // came from: job descriptions are employer-submitted once
      // PLAN-PHASE2.md's employer dashboard ships, and this component does not
      // depend on the caller having sanitized anything.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Raw HTML in a job description is ESCAPED, not passed through and not dropped.
// Same decision, and the same reasoning, as lib/blog.ts:25 — kept as a separate
// copy rather than an import because that module is `server-only` and pulls in
// node:fs, zod and marked; this component renders in either environment and
// must not inherit that constraint for five lines of string replacement.
//
// No sanitizer (DOMPurify/jsdom): PLAN-PHASE3.md §7.3 ruled that out for
// the sibling blog case, and it applies here too — nothing in a job description
// needs real HTML to survive, so escaping is the whole requirement.
//
// Escaping rather than dropping: nothing an employer wrote disappears silently.
// A pasted `<div>` shows up as visible text, which is how they find out.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Markdown → HTML for job descriptions. Exported so scripts/verify-jobs.ts
 * asserts THIS function rather than its own copy of the transforms — a test
 * that reimplements the pipeline passes while the component regresses.
 *
 * The escape happens first, on the original text only. Doing it after the
 * replacements would escape this function's own output (`<strong>`, `<h2>`,
 * `<ul>`) and render the formatting as literal tags. Nothing below reintroduces
 * or rewrites `&`, so the entities produced here are never double-encoded, and
 * `*`/`#`/`-` never occur inside an entity, so the markdown regexes cannot
 * match across one.
 */
export function parseMarkdown(text: string): string {
  return escapeHtml(text)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // H2 headings (##)
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // H3 headings (###)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // Bullet lists (lines starting with -)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> elements in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    // Paragraphs: blank lines → <p> breaks
    .split(/\n\n+/)
    .map((block) => {
      // Don't wrap headings or lists in <p>
      if (block.startsWith('<h') || block.startsWith('<ul')) return block;
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}
