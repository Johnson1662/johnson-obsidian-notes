# Agent Notes for Quartz v4

## Environment

- **Node.js**: >=22, **npm**: >=10.9.2 (enforced in `engines` and CI)
- **Module system**: ESM (`"type": "module"`)
- **JSX**: Preact (`jsxImportSource: "preact"`), not React

## Developer Commands

```bash
# Install dependencies
npm ci

# Type-check + format check (CI gate)
npm run check        # tsc --noEmit && prettier --check

# Auto-format
npm run format       # prettier --write

# Run all tests (Node built-in test runner via tsx)
npm test             # tsx --test

# Run a single test file
tsx --test quartz/util/path.test.ts

# Build the docs site (used in CI for smoke test)
npx quartz build --bundleInfo -d docs

# Dev server for local content
npx quartz build --serve

# Dev server for docs
npm run docs         # npx quartz build --serve -d docs
```

## Build System

- `npm run quartz` delegates to `./quartz/bootstrap-cli.mjs`
- The CLI is a thin yargs wrapper; `build` is the main command
- **Self-transpiling**: `handleBuild` uses `esbuild` to bundle `quartz/build.ts` (and all deps) into `quartz/.quartz-cache/transpiled-build.mjs` before executing it
- Source changes during `--serve` trigger a **hard rebuild** (re-transpile + re-run)
- Output directory defaults to `public/`, content to `content/`

## Code Style

- **Prettier**: no semicolons, 2-space indent, 100 print width, trailing commas
- **TypeScript**: strict, `noUnusedLocals`, `noUnusedParameters`
- Match existing code; do not add semicolons

## Architecture

- `quartz/plugins/` — transformer/filter/emitter pipeline
  - `transformers/` — markdown plugins (OFM, GFM, LaTeX, etc.)
  - `filters/` — content filters (drafts, explicit publish)
  - `emitters/` — output generators (pages, assets, index, OG images)
- `quartz/components/` — Preact UI components
- `quartz/processors/` — parse → filter → emit orchestration
- `quartz/styles/` — SCSS, compiled by esbuild `sassPlugin`
- `quartz/static/` — static assets copied to output
- `docs/` — documentation content, also used as CI smoke-test input

## Testing

- Uses Node.js **built-in** `node:test` + `node:assert`
- `tsx` is required to run TypeScript tests
- Tests live next to source: `*.test.ts`

## CI / Deploy

- **CI** (`v4` branch): `check` → `test` → `quartz build --bundleInfo -d docs`
- **Deploy** (`main` branch): builds to `public/` and uploads to GitHub Pages
- `fetch-depth: 0` is required in CI because git-history plugins depend on full history

## Common Gotchas

- Do not import React; use Preact imports (`preact`, `preact-render-to-string`)
- `quartz.config.ts` is the single source of truth for site config and plugin pipeline
- Generated cache lives in `.quartz-cache/` (ignored by Prettier but not by git by default)
- If adding a new plugin, register it in `quartz.config.ts` and ensure it is exported from `quartz/plugins/index.ts`
