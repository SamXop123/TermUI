# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

TermUI is a **full-stack terminal application framework** — the Next.js equivalent for the terminal. It is not just a UI component library; it provides everything needed to build production terminal apps: layout engine, JSX/component model, routing, global state, animations, theming, real-time data, hot-reload dev server, and a project scaffolding CLI. It is a **pnpm monorepo** managed with **Turborepo**, containing 13 packages under `packages/` and a documentation website under `website/`.

Package manager: `pnpm@9.15.0`. Node ≥ 18 required.

## Commands

All commands run from the repo root unless noted.

```bash
# Install dependencies
pnpm install

# Build all packages (respects Turbo dependency order)
pnpm build

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for a single package (e.g. core)
pnpm --filter @termuijs/core test

# Run a single test file
pnpm vitest run packages/core/src/layout/LayoutEngine.test.ts

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Clean all build artifacts and node_modules
pnpm clean
```

Tests live in `packages/*/src/**/*.test.ts` and run with **Vitest** (globals enabled, Node environment). The root `vitest.config.ts` configures this globally.

The `website/` is a separate Vite/React app (`cd website && pnpm dev`). It is not part of the Turbo build pipeline.

## Package Architecture

The dependency graph flows from primitives upward:

```
@termuijs/core          ← screen buffer, flexbox layout, input parser, event system
    ↓
@termuijs/widgets        ← widget class hierarchy (Box, Text, Table, List, etc.)
    ↓
@termuijs/jsx            ← JSX runtime + React-like hooks (useState, useEffect, useContext, memo)
@termuijs/tss            ← Terminal Style Sheets (CSS-like theming)
@termuijs/ui             ← composite interactive widgets (Select, Modal, Tabs, etc.)
    ↓
@termuijs/store          ← Zustand-like global state (depends on jsx)
@termuijs/motion         ← spring/easing animations (depends on core)
@termuijs/router         ← file-based screen routing (depends on core + widgets)
@termuijs/data           ← real-time system stats (CPU, memory, disk)
@termuijs/quick          ← fluent builder API for dashboards (depends on core + widgets)
@termuijs/testing        ← in-memory test renderer: render/query/fireKey/assert
@termuijs/dev-server     ← hot-reload dev server (<200ms restart)
create-termui-app        ← project scaffolding CLI
```

**Turbo task dependencies**: `build` requires upstream packages to build first (`^build`). `typecheck` and `test` also depend on `build`. Run `pnpm build` before `pnpm typecheck` or `pnpm test` if the `dist/` folders are missing.

## Core Concepts

### `@termuijs/core`
- `App` — application lifecycle manager: creates `Terminal`, `Screen`, `Renderer`, `LayerManager`, `InputParser`, `FocusManager`. Runs a render loop at configurable FPS.
- `Terminal` — raw TTY abstraction (alternate screen, mouse, resize).
- `Screen` — double-buffered cell grid; `Renderer` diffs and flushes ANSI escape sequences.
- `LayoutEngine` — Yoga-inspired flexbox layout operating on `LayoutNode` trees.
- `EventEmitter` — typed event bus used throughout the framework.

### `@termuijs/widgets`
- All widgets extend the base `Widget` class, which implements the `RootWidget` interface expected by `App`.
- Widgets form a tree; each implements `getLayoutNode()`, `render(screen)`, and optional `mount()`/`unmount()`.
- Widget categories: `display/` (Box, Text, LogView), `input/` (List, TextInput, VirtualList), `data/` (Table, Gauge, Sparkline, BarChart), `feedback/` (ProgressBar, Spinner, Scrollbar).

### `@termuijs/jsx`
- Custom JSX runtime (not React). Components are functions; reconciliation is handled by `reconciler.ts`.
- Hooks (`hooks.ts`) use a **Fiber** model — each component instance has a fiber tracking hook state, effects, intervals, and context values.
- Hook rules apply identically to React: call only at the top level of a component.
- `context.ts` implements `createContext`/`useContext` via fiber parent-chain traversal.
- `memo.ts` implements `memo()` for skipping re-renders.

### Testing
- Use `@termuijs/testing` for unit tests. It provides `render()` returning a `TestInstance` with `query`, `fireKey`, and assertion helpers — no real TTY needed.
- Test helpers for raw scenarios: `tests/helpers/mock-screen.ts`, `tests/helpers/mock-stdin.ts`.

## Build System

Each package uses **tsup** for bundling, producing both ESM (`dist/index.js`) and CJS (`dist/index.cjs`) with TypeScript declarations. The shared `tsconfig.base.json` sets `target: ES2022`, `module: NodeNext`, strict mode.

Each package has its own `tsconfig.json` that extends the base. Package exports use the `"exports"` field with `types`/`import`/`require` conditions.

## Website

`website/` is a TanStack Start + React + Vite app with MDX docs. It is not part of the monorepo's Turbo pipeline. The `prebuild` script runs `scripts/generate-llm-docs.mjs` to generate LLM-friendly docs before the Vite build.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`: installs with `pnpm install --frozen-lockfile`, runs `pnpm build`, then `pnpm test` on Node 24 / Ubuntu.
