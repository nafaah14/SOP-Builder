# SOP Builder — Agent Instructions

A standalone PWA for writing official-quality SOPs: steps, text, tables,
annotated photos, laid out and paginated automatically, exported to PDF.
Vite + React 19, local-first (IndexedDB), Google Drive sync (planned),
deployed as a Cloudflare Workers static-assets project (`wrangler.jsonc`). Separate from Daybook (`nafaah14/Daynote`) — it
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
- Fonts are listed in `layout/fonts.js`: built-ins (Helvetica, Times) use
  jsPDF's metrics; embedded families use generated width tables in
  `layout/fonts/*.json` — regenerate with `node scripts/gen-font-metrics.mjs`
  whenever a TTF in `public/fonts/` changes. Text boxes carry a font *role*
  (body, `heading`, `fallback`); the document maps roles to families.
- Characters the chosen font can't draw are split into runs drawn in DejaVu
  Sans (`layout/winansi.js`). Font files are fetched only for preview/export
  when a document uses them, and only those are embedded.
- Photos are stored in the IndexedDB `images` store and referenced by
  `imageId`; layout boxes carry the id and `render/exportAssets.js` loads
  the data for the PDF.
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
