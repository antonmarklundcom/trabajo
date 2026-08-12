// The one place article Markdown becomes HTML. No 'server-only' import here
// on purpose: `marked` is a pure JS library with no Node built-ins, and this
// module is imported both by lib/blog.ts (server reads) and by
// components/admin/BlogForm.tsx (client-side live preview) — a client
// component cannot import anything tagged 'server-only'. Reusing this exact
// function from both places is the point: a second markdown implementation
// for the preview would widen the XSS surface AGENTS.md and PLAN-PHASE3-DRAFT
// §5 both call out.
import { marked } from 'marked';

// Raw HTML in an article is ESCAPED, not passed through and not dropped.
//
// `marked` passes raw HTML through verbatim by default and has had no
// `sanitize` option since v5. Without the renderer override below, a
// `<script>` typed into the admin textarea reaches post.html and then
// dangerouslySetInnerHTML — verified, not assumed
// (scripts/verify-blog.ts asserts it on every push).
//
// Escaping rather than dropping: nothing an author wrote disappears silently.
// A pasted `<div>` shows up as visible text, which is how the author finds
// out.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

marked.setOptions({ gfm: true });
marked.use({
  renderer: {
    html(token) {
      return escapeHtml(typeof token === 'string' ? token : (token.raw ?? token.text ?? ''));
    },
  },
});

export function renderMarkdown(body: string): string {
  return marked.parse(body, { async: false });
}
