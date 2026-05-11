# @termuijs/motion

Animations for terminal UIs. Spring physics for things that should feel physical; easing curves for things that should feel timed.

All animations skip to their final value when `NO_MOTION=1` is set. This makes your app work correctly in CI, screen readers, and reduced-motion environments without any changes to your code.

## Install

```bash
npm install @termuijs/motion
```

Requires `@termuijs/core`.

## Springs

Springs simulate real physics. Set stiffness, damping, and mass; let the spring figure out the motion.

```typescript
import { animateSpring } from '@termuijs/motion'

animateSpring(
    { from: 0, to: 100 },
    (value) => progressBar.setValue(value / 100),
    () => console.log('done'),
)
```

### Presets

```typescript
import { SPRING_PRESETS, animateSpring } from '@termuijs/motion'

animateSpring(
    { from: 0, to: 1, ...SPRING_PRESETS.stiff },
    onFrame,
)
```

| Preset | Feel |
|--------|------|
| `default` | Balanced. Good starting point |
| `stiff` | Snappy, minimal bounce |
| `gentle` | Slow, smooth glide |
| `wobbly` | Bouncy, springy feel |
| `slow` | Very slow, dramatic |
| `molasses` | Extremely slow |

### Spring parameters

| Parameter | What it controls | Default |
|-----------|-----------------|---------|
| `stiffness` | How tight the spring pulls. Higher = snappier | 170 |
| `damping` | How fast oscillation settles. Higher = less bounce | 26 |
| `mass` | Inertia. Higher = slower to get moving | 1 |

## Transitions

For animations with a fixed duration rather than physics behavior:

```typescript
import { transition } from '@termuijs/motion'

transition({
    from: 0,
    to: 1,
    duration: 300,
    easing: 'ease-out',
    onFrame: (v) => widget.setOpacity(v),
})
```

## NO_MOTION support

When `NO_MOTION=1`, both `animateSpring` and `transition` call `onFrame` once with the final value, then call `onComplete`. No animation loop runs. This is automatic; you don't need to check the flag yourself.

```bash
NO_MOTION=1 node app.js  # All animations resolve instantly
```

## Timer pool integration

Animations use `timerPoolSubscribe` from `@termuijs/core` instead of raw `setTimeout`. All active animations share one underlying 16ms timer, so CPU usage stays flat regardless of how many animations run simultaneously.

## Documentation

Full docs at [www.termui.io/docs/motion/springs](https://www.termui.io/docs/motion/springs).

## License

MIT
