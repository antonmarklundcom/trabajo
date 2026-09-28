# Downloadable templates (public/descargas/)

The downloadable CV templates linked from `/curriculum-vitae/plantillas`, and
the Word contract model linked from `/contrato-de-trabajo` (Word only, no PDF), are
static files committed under `public/descargas/`. They are built once from the
two scripts here and are **not** generated at build or run time (nothing is
ever written into `public/` at runtime — AGENTS.md).

To change a template, edit both scripts (the Word and PDF versions carry the
same content) and regenerate from a scratch directory:

```bash
mkdir -p /tmp/cv && cd /tmp/cv && npm init -y && npm install docx playwright
node /path/to/repo/scripts/cv-templates/generate-docx.cjs /path/to/repo/public/descargas
CHROMIUM_PATH=/opt/pw-browsers/chromium node /path/to/repo/scripts/cv-templates/render-pdf.cjs /path/to/repo/public/descargas
```

`docx` and `playwright` are deliberately not dependencies of the app.
