<p align="center">
  <h1 align="center">TermUI</h1>
  <p align="center">Build terminal applications in TypeScript.</p>
</p>

<p align="center">
  <a href="https://www.termui.io/docs/getting-started/installation"><img src="https://img.shields.io/badge/docs-termui.io-00ff88?style=flat" alt="Documentation"></a>
  <a href="https://www.npmjs.com/package/@termuijs/core"><img src="https://img.shields.io/npm/v/@termuijs/core.svg" alt="npm version"></a>
  <a href="https://github.com/Karanjot786/TermUI/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/tests-598%20passing-brightgreen" alt="598 tests passing">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript 5.7">
</p>

## What is TermUI?

TermUI is a TypeScript framework for building terminal apps. You get a layout engine, JSX support, React-style hooks, focus management, global state, theming, animations, routing, real-time data, error boundaries, and a hot-reload dev server. No curses bindings. No C extensions. Pure TypeScript.

## Quick Start

```bash
npx create-termui-app my-app
cd my-app
npm install
npm run dev
```

## Manual Setup

```bash
npm install @termuijs/core @termuijs/widgets @termuijs/jsx
```

```tsx
import { App } from '@termuijs/core'
import { Box, Text } from '@termuijs/widgets'
import { useState, useKeymap, ErrorBoundary } from '@termuijs/jsx'

function Counter() {
    const [count, setCount] = useState(0)

    useKeymap({
        '+':      () => setCount((c) => c + 1),
        'ctrl+c': () => process.exit(0),
    })

    return (
        <Box border="round" padding={1}>
            <Text bold>Count: {count}</Text>
            <Text dim>Press + to increment, ctrl+c to quit</Text>
        </Box>
    )
}

render(
    <ErrorBoundary fallback={(e) => <Text color="red">{e.message}</Text>}>
        <Counter />
    </ErrorBoundary>
)
```

## Packages

| Package | What it does |
|---------|-------------|
| [`@termuijs/core`](./packages/core) | Screen buffer, input parsing, event system, flexbox layout, caps flags, WCAG utilities |
| [`@termuijs/widgets`](./packages/widgets) | 40+ widgets: Box, Text, Table, VirtualList, StreamingText, ChatMessage, ToolCall, Card, Sidebar, LineChart, HeatMap, and more |
| [`@termuijs/ui`](./packages/ui) | Select, Tabs, Modal, Toast, NotificationCenter, imperative prompts, PasswordInput, NumberInput, PathInput |
| [`@termuijs/jsx`](./packages/jsx) | JSX runtime with useState, useEffect, useKeymap, useMotion, ErrorBoundary, and a complete focus system |
| [`@termuijs/store`](./packages/store) | Zustand-style global state with selector subscriptions and batch updates |
| [`@termuijs/testing`](./packages/testing) | In-memory test renderer: render, query, fireKey, waitFor, renderToString |
| [`@termuijs/tss`](./packages/tss) | Terminal Style Sheets with variables, pseudo-classes, AutoThemeProvider, and useTheme |
| [`@termuijs/motion`](./packages/motion) | Spring-physics and easing animations; respects NO_MOTION |
| [`@termuijs/router`](./packages/router) | File-based screen routing with typed params, guards, and ErrorBoundary wrapping |
| [`@termuijs/data`](./packages/data) | Real-time system data: CPU, memory, disk, network, processes; raw API and reactive hooks |
| [`@termuijs/dev-server`](./packages/dev-server) | Hot-reload dev server with graceful restart in under 200ms |
| [`@termuijs/quick`](./packages/quick) | Fluent builder API for dashboards in ~20 lines |
| [`create-termui-app`](./packages/create-termui-app) | Project scaffolding CLI |

## Features

### useKeymap

Declare key bindings as a map. Cleaner than chained if-statements. Multiple calls in one component are additive.

```tsx
import { useKeymap } from '@termuijs/jsx'

function App() {
    useKeymap({
        'ctrl+c': () => process.exit(0),
        'ctrl+s': () => save(),
        '/':      () => openSearch(),
        '?':      () => showHelp(),
    })
    return <Box>...</Box>
}
```

### Focus management

Four hooks for building keyboard-accessible interfaces:

```tsx
import { useFocusManager, useFocus, useFocusTrap, useKeyboardNavigation } from '@termuijs/jsx'

// App root: owns global focus state
function App() {
    const { FocusContext, focus, blur, focused } = useFocusManager()
    return (
        <FocusContext.Provider value={{ focus, blur, focused }}>
            <Screen />
        </FocusContext.Provider>
    )
}

// Modal: Tab key stays inside
function Modal({ fieldIds }) {
    useFocusTrap(fieldIds)
    return <Box>...</Box>
}

// List: standard arrow key navigation
function List({ items }) {
    const { selectedIndex } = useKeyboardNavigation({ items, loop: true })
    return <Box>...</Box>
}
```

### ErrorBoundary

Wrap any subtree. Errors show a fallback instead of crashing the app.

```tsx
import { ErrorBoundary } from '@termuijs/jsx'

<ErrorBoundary fallback={(err) => <Text color="red">Error: {err.message}</Text>}>
    <Dashboard />
</ErrorBoundary>
```

### Capability flags

TermUI checks the terminal environment before rendering unicode or animations. Set environment variables to get ASCII output in CI or reduced-motion output for accessibility.

```bash
NO_UNICODE=1  # ASCII fallbacks for all widgets
NO_MOTION=1   # Skip all animations; static output
NO_COLOR=1    # Disable ANSI color sequences
```

```typescript
import { caps } from '@termuijs/core'

const bullet = caps.unicode ? '●' : '*'
```

### Notifications

```tsx
import { NotificationCenter, useNotifications } from '@termuijs/ui'

function App() {
    return (
        <Box>
            <NotificationCenter position="top-right" />
            <Dashboard />
        </Box>
    )
}

function Dashboard() {
    const { notify } = useNotifications()

    useKeymap({
        's': async () => {
            await save()
            notify('Saved', { type: 'success', duration: 2000 })
        },
    })
    return <Box>...</Box>
}
```

### Imperative prompts

Ask for user input without restructuring your component tree.

```typescript
import { prompt } from '@termuijs/ui'

const ok = await prompt.confirm('Delete all logs?')
if (ok) deleteLogs()

const name = await prompt.text('Enter a name:')
const env = await prompt.select('Choose environment:', ['dev', 'staging', 'prod'])
```

### Global state with batch updates

```typescript
import { createStore, batch } from '@termuijs/store'

const useAppStore = createStore((set) => ({
    count: 0,
    label: '',
    increment: () => set((s) => ({ count: s.count + 1 })),
}))

// Multiple updates; one render pass
batch(() => {
    useAppStore.setState({ count: 10 })
    useAppStore.setState({ label: 'done' })
})
```

### Theming

```typescript
import { AutoThemeProvider, useTheme } from '@termuijs/tss'
import { tokensToTSS, nordTheme } from '@termuijs/tss'

// Detect terminal background and pick the closest theme
<AutoThemeProvider fallback="dracula">
    <App />
</AutoThemeProvider>

// Switch at runtime
const { theme, setTheme } = useTheme()
setTheme('catppuccin')

// Use token objects directly
const primary = nordTheme['--primary']
```

### AI widgets

Display AI tool usage and streaming output with purpose-built widgets:

```tsx
import { StreamingText, ChatMessage, ToolCall } from '@termuijs/widgets'

<ChatMessage role="assistant" content="Here is the result..." />
<ToolCall name="read_file" status="running" args={{ path: '/etc/hosts' }} />
<StreamingText text="Generating response..." speed={30} />
```

### VirtualList

Renders only visible rows. A list of 1,000,000 items performs the same as a list of 10.

```typescript
const list = new VirtualList({
    totalItems: 1_000_000,
    renderItem: (index) => `Log line ${index}`,
    onSelect: (index) => inspect(index),
})
```

### Reactive system data

```tsx
import { useCpu, useMemory, useHttpHealth } from '@termuijs/data'

function Dashboard() {
    const cpu  = useCpu(500)
    const mem  = useMemory(1000)
    const checks = useHttpHealth(['https://api.example.com/health'], 5000)

    return (
        <Box flexDirection="column">
            <Text>CPU: {cpu.usage.toFixed(1)}%</Text>
            <Text>MEM: {(mem.used / mem.total * 100).toFixed(1)}%</Text>
        </Box>
    )
}
```

### Testing

```tsx
import { render } from '@termuijs/testing'

const t = render(<Counter />)
t.fireKey('+')
expect(t.getByText('Count: 1')).toBeTruthy()

// Async assertions
await t.waitFor(() => {
    expect(t.getByText('Loaded')).toBeTruthy()
})

// ANSI-free snapshot
expect(t.renderToString()).toContain('Count: 1')
t.unmount()
```

## Architecture

```
Application Layer:    @termuijs/ui · @termuijs/quick · create-termui-app
Component Layer:      @termuijs/widgets · @termuijs/jsx · @termuijs/store · @termuijs/testing
Feature Layer:        @termuijs/tss · @termuijs/router · @termuijs/motion
Core Layer:           @termuijs/core · @termuijs/data
Dev tooling:          @termuijs/dev-server
```

Every layer depends only on the layers below it. Use any package independently.

## Examples

### System dashboard (Quick API)

```typescript
import { app, gauge, table } from '@termuijs/quick'
import { useCpu, useMemory } from '@termuijs/quick'

app('System Monitor')
    .rows(
        app.cols(
            gauge('CPU', () => useCpu().usage / 100),
            gauge('MEM', () => useMemory().percent / 100),
        ),
        table('Processes', {
            columns: ['Name', 'PID', 'CPU%'],
            data: () => processes.top(10).map((p) => ({
                Name: p.name,
                PID: p.pid,
                'CPU%': p.cpu.toFixed(1),
            })),
        }),
    )
    .run()
```

### AI assistant dashboard

```typescript
import { app, chatMessage, toolCall, streamingText } from '@termuijs/quick'

app('AI Assistant')
    .rows(
        chatMessage({ role: 'user', content: 'Show me the top processes' }),
        toolCall({ name: 'get_processes', status: 'running' }),
        streamingText({ text: 'Fetching system data...', speed: 40 }),
    )
    .run()
```

## Running the examples

```bash
git clone https://github.com/Karanjot786/TermUI.git
cd TermUI
pnpm install
pnpm build

cd examples/dashboard
npx tsx src/index.tsx
```

Five examples: `dashboard`, `jsx-dashboard`, `showcase`, `system-monitor`, `todo-app`.

## Project structure

```
packages/
  core/              Screen buffer, input, events, layout, caps flags
  widgets/           Widget library (40+ widgets)
  ui/                High-level components and inputs
  jsx/               JSX runtime, hooks, focus system, ErrorBoundary
  store/             Global state management
  testing/           Test renderer
  tss/               Terminal Style Sheets and theming
  motion/            Spring animation engine
  router/            File-based routing
  data/              System data providers and hooks
  dev-server/        Hot-reload dev server
  quick/             Fluent builder API
  create-termui-app/ Project scaffolding CLI
examples/
  dashboard/         Real-time system monitor
  jsx-dashboard/     JSX-based dashboard
  showcase/          Widget gallery
  system-monitor/    Advanced monitor
  todo-app/          Interactive todo list
```

## Development

```bash
pnpm install
pnpm build      # Build all 13 packages
pnpm test       # Run all 598 tests
pnpm typecheck  # Type-check all packages
```

## Requirements

- Node.js 18+
- A terminal with TTY support (256-color or truecolor recommended)

## License

MIT
