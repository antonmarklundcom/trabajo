// POST /api/admin/blog/preview — Markdown in, rendered HTML out.
//
// Exists so the editor previews through renderMarkdown() itself rather than a
// second Markdown implementation running in the browser. A client-side preview
// would be a different renderer with different escaping rules, which means the
// preview could look right while the published page did not — and the escaping
// is the part that must not diverge (lib/blog.ts).
//
// Session-gated even though it stores nothing: it renders attacker-supplied
// Markdown on request, so leaving it open would be donating CPU.
import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { renderMarkdown } from '@/lib/blog';

const previewSchema = z.object({ body: z.string().max(60000) });

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const parsed = previewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: 'Contenido inválido.' }, { status: 400 });
    }

    return Response.json({ html: renderMarkdown(parsed.data.body) });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
