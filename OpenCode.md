# OpenCode Commands & Style Guide

## Commands
- **dev:** `npm run dev` (starts Vite + Python backend + WhatsApp service concurrently)
- **build:** `npm run build` (Vite production build)
- **lint (typecheck):** `npm run lint` (runs `tsc --noEmit`)
- **No test framework configured** — add Vitest if needed and run with `npx vitest run path/to/file.test.tsx`
- **Clean:** `npm run clean` (rm -rf dist)

## Code Style
- **Imports:** React first (`import React, { useState, ... } from 'react'`), then lucide icons, then local modules. Named exports for services/storage, `export default` for components.
- **Path alias:** Use `@/` for project root (e.g. `@/components/Foo` maps to `./components/Foo`).
- **Formatting:** Single quotes, semicolons. Tailwind CSS v4 for styling (`@import "tailwindcss"` + `@theme` custom vars). Dark theme (--bg: #0F1115).
- **Types:** All shared interfaces in `src/types.ts`. Inline prop types for React components. Use `Partial<CellData>` for state updates.
- **Components:** PascalCase filenames in `src/components/`. Wrap export in `React.memo()` for pure/presentational components. Props destructured inline.
- **React patterns:** Prefer `useCallback` for event handlers passed as props. `useRef<HTMLDivElement>(null)` for DOM refs.
- **IDs:** Use inline `mkId()` — `Math.random().toString(36).substr(2, 9)`.
- **Error handling:** `try/catch` with `(err: any)`. Loading/error states via boolean flags in state interfaces (e.g. `isLoading`).
- **State:** localStorage via `notebookStorage.ts`, synced to Python DB (`http://localhost:8766`). Auth via `process.env.APP_SECRET_TOKEN` in `X-App-Token` header.
- **AI providers:** Configured in `src/providers/registry.ts`, adapters in `src/providers/adapters.ts`.
