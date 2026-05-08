# TermUI Sprint 1: Bug Fixes + Performance Design

**Date:** 2026-05-08  
**Status:** Approved  
**Scope:** 12 targeted fixes across 11 files. No new abstractions. No VNode diffing (Sprint 1.5).

## Context

Deep audit of all 13 TermUI packages found critical memory leaks, broken optimizations, and allocation hotspots. This sprint stabilizes the foundation before:
- Sprint 2: Migrate runtime from Node.js to Bun (5-10x startup, ~8-12MB vs 15-30MB RAM)
- Sprint 3: Nested routing+layouts, `useData()` reactive hook, ErrorBoundary, in-process dev tools

## Part 1: Bug Fixes

### 1. Store `Object.is()` logic bug
**File:** `packages/store/src/store.ts:92`

After `{ ...state, ...nextPartial }`, the new object never passes `Object.is()` referential check — always `false`. Every `setState()` fires all listeners even when nothing changed.

**Fix:** Shallow per-key comparison on the partial:
```typescript
const hasChanged = Object.keys(nextPartial).some(
  key => !Object.is((state as any)[key], (nextState as any)[key])
);
if (hasChanged) {
  state = nextState;
  for (const listener of listeners) listener(state, prevState);
}
```

### 2. App event listener cleanup
**File:** `packages/core/src/app/App.ts:136-170`

`onKey()` and `onMouse()` return unsubscribe fns that are discarded. Repeated mount/unmount accumulates dead listeners.

**Fix:**
```typescript
private _unsubKey?: () => void;
private _unsubMouse?: () => void;
// mount: this._unsubKey = this.input.onKey(...)
// unmount: this._unsubKey?.(); this._unsubMouse?.();
```

### 3. AppBuilder event listener cleanup
**File:** `packages/quick/src/app.ts:169, 177, 186`

Three listeners (`focus`, `blur`, `key`) never unsubscribed. Same accumulation pattern.

**Fix:** Capture all three unsubscribe fns, call them in `exit()` cleanup handler.

### 4. InputParser escape timeout leak
**File:** `packages/core/src/input/InputParser.ts:86-220`

Three `setTimeout` assignment sites, all to `_escapeTimeout`. If `stop()` is not called or fires mid-sequence, a timeout may fire post-shutdown.

**Fix:** Ensure `stop()` always calls `clearTimeout(this._escapeTimeout)` before any other cleanup. Single shared handle, always written, always cleared.

### 5. `_latencyHistory` Map unbounded growth
**File:** `packages/data/src/http.ts:18-41`

No URL eviction. Long-running apps that ping many endpoints accumulate unbounded entries.

**Fix:** Cap at 100 URLs; evict oldest (Map preserves insertion order):
```typescript
const MAX_URLS = 100;
if (_latencyHistory.size >= MAX_URLS) {
  _latencyHistory.delete(_latencyHistory.keys().next().value!);
}
```

### 6. Terminal crash leaves raw mode active
**File:** `packages/core/src/terminal/Terminal.ts` (~line 199)

Unhandled exceptions corrupt terminal state (raw mode, alternate screen, hidden cursor). Users are stuck with a broken shell.

**Fix:** Register in constructor:
```typescript
const restore = () => this.restore();
process.once('uncaughtException', (err) => { restore(); throw err; });
process.once('unhandledRejection', () => { restore(); process.exit(1); });
```

### 7. Orphaned child fibers in `_instanceMap`
**File:** `packages/jsx/src/reconciler.ts:263-269`

`reRenderComponent()` deletes the parent instance but leaves child instances in the map — stale fiber references, unbounded map growth.

**Fix:** Add `_pruneDescendants(fiber: Fiber)` helper. Before deleting parent, recursively walk `fiber.children` (or parent-chain reverse) and delete all descendant entries from `_instanceMap`.

---

## Part 2: Performance

### 8. Color object pool
**File:** `packages/core/src/terminal/Screen.ts:57`

`resetCell()` allocates `{ type: 'none' }` for `fg` and `bg` every reset.  
At 30 FPS × 1,920 cells × 2 colors = **115,200 object allocations/second** → GC pressure.

**Fix:** Singleton frozen constants:
```typescript
export const EMPTY_COLOR: Color = Object.freeze({ type: 'none' } as const);
// resetCell(): cell.fg = EMPTY_COLOR; cell.bg = EMPTY_COLOR;
```
Zero per-reset allocation.

### 9. Widget ID cache (O(1) focus lookup)
**File:** `packages/core/src/app/App.ts:293-309`

`_buildBubbleChain()` → `_findWidgetById()` is an O(n) DFS on every keypress.

**Fix:** `_widgetById = new Map<string, Widget>()` on App. Widget base class `mount(registry?)` registers self; `unmount()` deregisters. Replace DFS with `this._widgetById.get(id)`.

### 10. Layout dirty flags
**File:** `packages/core/src/layout/LayoutEngine.ts`

`computeLayout()` runs every frame unconditionally — 200 flexbox passes/frame for a stable 200-widget UI.

**Fix:** `_dirty: boolean` on `LayoutNode`. Set true on style change, child add/remove, resize (all nodes). `computeLayout()` skips subtrees where `!node._dirty`. Reset after computing.

### 11. Fix `memo()` — wire to reconciler
**Files:** `packages/jsx/src/memo.ts:53-78`, `packages/jsx/src/reconciler.ts:216`

`memo()` returns cached VNode on prop equality, but `reconcile()` always creates new widgets from the VNode. The optimization does nothing.

**Fix:** Store `lastVNode` on ComponentInstance. In `reconcile()`:
```typescript
const newVNode = component(props);
if (instance?.lastVNode === newVNode) return instance.widget; // memo hit
instance.lastVNode = newVNode;
```

### 12. Widget event cleanup on unmount
**File:** `packages/widgets/src/base/Widget.ts`

Replaced widgets retain EventEmitter listeners indefinitely.

**Fix:** Default `unmount()` in Widget base class calls `this.events.removeAll()`. Reconciler already calls `unmount()` on replaced widgets.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/store/src/store.ts` | Per-key shallow compare instead of `Object.is(state, nextState)` |
| `packages/core/src/app/App.ts` | `_unsubKey/_unsubMouse`; `_widgetById` Map; O(1) bubble chain |
| `packages/quick/src/app.ts` | 3 unsubscribe captures + cleanup |
| `packages/core/src/input/InputParser.ts` | `clearTimeout` in `stop()` |
| `packages/data/src/http.ts` | `MAX_URLS = 100`, LRU eviction |
| `packages/core/src/terminal/Terminal.ts` | uncaughtException + unhandledRejection |
| `packages/jsx/src/reconciler.ts` | `_pruneDescendants`; `lastVNode` memo check |
| `packages/jsx/src/memo.ts` | Verified same-ref return on cache hit |
| `packages/core/src/terminal/Screen.ts` | `EMPTY_COLOR` singleton |
| `packages/core/src/layout/LayoutEngine.ts` | `_dirty` flag, skip clean subtrees |
| `packages/widgets/src/base/Widget.ts` | `events.removeAll()` in `unmount()`; `mount(registry?)` |

---

## Verification

```bash
pnpm build     # Must pass
pnpm test      # Must pass
pnpm typecheck # Must pass
```

Regression checks:
- Store: `setState` with same values → no listener fires
- Memo: wrapped component renders once, props unchanged → render count stays at 1
- Terminal: throw in widget render → terminal restores (cursor visible, normal mode)
- App: mount/unmount 10× → input listener count constant

---

## Out of Scope

- VNode diffing (React-style reconciliation) — Sprint 1.5
- Flat 1D cell buffer — Sprint 2 (Bun migration)
- Nested routing, `useData()`, ErrorBoundary, dev tools — Sprint 3
