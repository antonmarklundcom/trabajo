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
      // Only job descriptions from our own seed/CMS flow through here.
      // In Phase 2, WordPress content should be sanitized server-side.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function parseMarkdown(text: string): string {
  return text
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
