# SOP Builder

Write standard operating procedures as a list of steps; get back a properly
formatted, paginated, official-looking PDF.

- **Long canvas of blocks** — sections, steps, text, page breaks (tables,
  callouts and images next). Add between any two blocks, drag or ↑/↓ to
  reorder, duplicate, delete with undo.
- **Automatic formatting** — numbering (1, 1.1, 1.2 …), spacing, keep step
  headings with their text, widow/orphan control, header and footer with
  fields such as `{docNo}`, `{rev}`, `Page {page} of {pages}`.
- **Live page breaks** — dashed "Page N" markers on the canvas show exactly
  where the PDF will break.
- **Preview at any time** — the same page boxes the PDF is drawn from; tap
  text in the preview to jump to its block.
- **Local-first** — documents are kept in IndexedDB and autosave.

Body text format: one paragraph per line, `- ` bullets, `1. ` numbered items,
`**bold**`, `*italic*`.

## How layout works

```
Document JSON ──► layout(doc, measure) ──► pages[{ boxes }]
                                             ├─► PagePreview (SVG)
                                             └─► pdfWriter (jsPDF)
```

A document is up to four parts, each starting on a new page: cover,
revision history, contents, body. The cover is a fixed composition
(`layout/cover.js`); the others flow through `layout/paginate.js`. Contents
is laid out twice — once to learn its length, then with real page numbers.
Tables (`layout/table.js`) never split a row and repeat their header row on
each page.

Templates are copied into an SOP when applied, not linked, so editing a
template never changes an already-issued document. "Re-apply" pulls changes
in on purpose.

Each block becomes rows (a line of text, a heading line, a rule). Rows carry a
`gap` (dropped at the top of a page) and `glue` (never break after this row).
Headings glue to the following lines; a paragraph's first two and last two
lines glue together. The paginator places glued chunks whole, moving them to
the next page when they don't fit.

## Roadmap

1. ✅ Model, layout engine, canvas, reorder/delete/undo, page-break markers,
   preview, PDF with header/footer/page numbers.
2. ✅ Cover page (Classic, Corporate band, Minimal), document approval table,
   revision history, auto contents with page numbers and PDF links,
   reusable templates/branding (logo, company, colours, header/footer).
3. Tables (repeat header row across pages) and callouts (warning, caution,
   note, tip).
4. Images — camera, upload, paste; placement rules.
5. Annotation editor — arrows, boxes, circles, highlighter, numbered markers,
   text labels, blur, crop/rotate; non-destructive.
6. Google Drive sync, `.sop` backup files, PWA install, Cloudflare Pages.

## Deploy (Cloudflare Workers)

Connected to Git in the Cloudflare dashboard; every push to `main` deploys.
Build command `npm run build`, deploy command `npx wrangler deploy`.
`wrangler.jsonc` serves `dist/` as static assets with single-page-app
fallback, so `/doc/<id>` survives a reload. Without that file wrangler tries
to auto-detect the project from `vite.config.js` and fails.
