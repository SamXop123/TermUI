# @termuijs/router

Screen routing for terminal apps. Register screens by name or point it at a directory and let the file system define your routes.

## Install

```bash
npm install @termuijs/router
```

Requires `@termuijs/core` and `@termuijs/widgets`.

## Manual routing

```typescript
import { Router } from '@termuijs/router'

const router = new Router()

router.register('home', homeWidget)
router.register('settings', settingsWidget)
router.register('help', helpWidget)

router.push('settings')
router.back()

console.log(router.current)  // 'home'
```

## File-based routing

Point the router at a directory. Each file becomes a screen:

```
screens/
  index.ts      -> /
  settings.ts   -> /settings
  help.ts       -> /help
  users/
    [id].ts     -> /users/[id]
```

```typescript
const router = new Router({ dir: './screens' })

router.push('/users/42')
// Screen receives { id: '42' } as params
```

## Route params

Dynamic segments use brackets in the filename. Params are available inside the screen component.

```typescript
// screens/logs/[level].ts
export default function LogScreen({ params }) {
    const { level } = params
    return <LogView filter={level} />
}
```

## Error handling

Each routed screen is wrapped in an `ErrorBoundary`. If a screen component throws, a default error screen appears instead of crashing the app. Pass `errorFallback` to customize the error UI:

```typescript
const router = new Router({
    dir: './screens',
    errorFallback: (err) => (
        <Box borderColor="red">
            <Text color="red">Screen error: {err.message}</Text>
        </Box>
    ),
})
```

## History

The router keeps a navigation stack. `push()` adds to it, `back()` pops. Inspect the full stack with `router.history`. Old screen fibers are unmounted before the new screen mounts, so there are no memory leaks from stale components.

## Guards

Run a check before entering a route. Return `false` or a redirect path to block navigation.

```typescript
router.guard('/settings', () => {
    if (!isAuthenticated) return '/login'
    return true
})
```

## Documentation

Full docs at [www.termui.io/docs/router/overview](https://www.termui.io/docs/router/overview).

## License

MIT
