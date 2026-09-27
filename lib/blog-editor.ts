// What the article editor measures while an editor types (PLAN-GROWTH.md §4
// C3): word count, reading time, and a live SEO checklist built from the C0
// content brief. Advice, not validation — the server enforces the hard limits
// (app/api/admin/blog/schema.ts); nothing here blocks a save.
//
// Pure functions over the form's own strings, no server-only or database
// import: BlogPostForm.tsx ('use client') renders from it, and
// scripts/verify-blog.ts asserts it under plain tsx.

/** Words in a Markdown body: link targets, code and syntax don't count. */
export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/\]\([^)]*\)/g, ']') // link / image destinations
    .replace(/<[^>]*>/g, ' '); // stray HTML (rendered escaped, not read)
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Minutes at ~200 words per minute, never less than one. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

/**
 * A Markdown link to a page that turns a reader into a job seeker: the job
 * list, a category landing or a city landing — relative, or absolute on the
 * production host. The internal link every C0 article carries.
 */
const LANDING_LINK = /\]\(\s*(?:https?:\/\/(?:www\.)?trabajo\.com\.py)?\/(?:empleos|trabajo|trabajo-en)(?=[/?#)\s]|$)/;

export type SeoCheck = { id: string; label: string; ok: boolean; hint: string };

export function seoChecklist(input: {
  title: string;
  description: string;
  body: string;
  category: string;
  relatedCategory: string;
}): SeoCheck[] {
  const title = input.title.trim();
  const description = input.description.trim();
  const words = wordCount(input.body);

  const linkMatch = LANDING_LINK.exec(input.body);
  const wordsBeforeLink = linkMatch ? wordCount(input.body.slice(0, linkMatch.index)) : Infinity;

  const checks: SeoCheck[] = [
    {
      id: 'title-length',
      label: 'Título de 30 a 60 caracteres',
      ok: title.length >= 30 && title.length <= 60,
      hint: `${title.length} caracteres. Google corta los títulos largos; uno corto desaprovecha el resultado.`,
    },
    {
      id: 'description-length',
      label: 'Descripción de 70 a 160 caracteres',
      ok: description.length >= 70 && description.length <= 160,
      hint: `${description.length} caracteres. Es el texto que se lee debajo del título en Google.`,
    },
    {
      id: 'has-h2',
      label: 'Al menos un subtítulo (##)',
      ok: /^##[ \t]+\S/m.test(input.body),
      hint: 'Los subtítulos ordenan la nota y habilitan el índice "En esta nota".',
    },
    {
      id: 'landing-link',
      label: 'Enlace a /empleos o a una página de empleos (/trabajo/…)',
      ok: linkMatch !== null,
      hint: 'Por ejemplo [empleos de ventas](/trabajo/ventas). Es lo que conecta la nota con los avisos.',
    },
    {
      id: 'landing-link-early',
      label: 'Ese enlace aparece en las primeras 200 palabras',
      ok: wordsBeforeLink <= 200,
      hint: linkMatch
        ? `Aparece después de ${wordsBeforeLink} palabras.`
        : 'Todavía no hay un enlace a una página de empleos.',
    },
    {
      id: 'length',
      label: 'Al menos 700 palabras',
      ok: words >= 700,
      hint: `${words} palabras. Las notas del blog apuntan a 700–1200.`,
    },
  ];

  if (input.category === 'guias-por-sector') {
    checks.push({
      id: 'guide-related-category',
      label: 'Guía por sector con su categoría de empleos',
      ok: input.relatedCategory.trim() !== '',
      hint: 'Obligatorio: es lo que muestra la guía en la página de esa categoría.',
    });
  }

  return checks;
}
