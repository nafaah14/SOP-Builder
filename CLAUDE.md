# SOP Builder — Agent Instructions

A standalone PWA for writing official-quality SOPs: steps, text, tables,
annotated photos, laid out and paginated automatically, exported to PDF.
Vite + React 19, local-first (IndexedDB), Google Drive sync (planned),
deployed on Cloudflare Pages. Separate from Daybook (`nafaah14/Daynote`) — it
copies some patterns from there but shares no code.

## Commands

```bash
npm run dev      # vite dev server
npm test         # vitest run
npm run lint     # oxlint
npm run build    # vite build -> dist/
```

Run `npm test` and `npm run build` before committing anything non-trivial.

## Architecture rules

- **One layout engine, two renderers.** `src/layout/engine.js` turns the
  document into positioned page boxes. The preview (`render/PagePreview.jsx`)
  and the PDF (`render/pdfWriter.js`) only draw those boxes — never make a
  layout decision in a renderer, or the preview and PDF drift apart.
- Text is measured with jsPDF's Helvetica metrics (`layout/measure.js`) on
  both sides. If fonts change, change them in the measurer and the writer
  together.
- Pagination is rows + glue. Keep-with-next, widow/orphan control and
  "don't split" are expressed as `glue` on rows, not as special cases in the
  paginator.
- The document is immutable JSON; every edit is a pure function in
  `src/model/ops.js`, so undo is snapshots (`editor/useHistory.js`).
- Numbers (1, 1.2 …) are derived from order (`model/numbering.js`), never
  stored.

## Workflow conventions

- Bump `package.json` version with every notable change (minor for features,
  patch for fixes). Shown on the home screen next to the build id.
- Match surrounding code style; keep comments sparse.
- The plan and phase order live in `README.md` → Roadmap.
