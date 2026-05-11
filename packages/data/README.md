# @termuijs/data

Real-time system metrics for TermUI. CPU, memory, disk, network, processes, and HTTP health; available as raw function calls or as reactive hooks for JSX components.

## Install

```bash
npm install @termuijs/data
```

## Raw API

Call these functions directly for one-shot reads:

```typescript
import { cpu, memory, disk, network, processes, system } from '@termuijs/data'

// CPU
console.log(cpu.percent)    // 45.2
console.log(cpu.cores)      // 8

// Memory
console.log(memory.used)    // bytes
console.log(memory.total)   // bytes
console.log(memory.percent) // 67.1

// Disk
console.log(disk.percent)   // 52.3

// Top processes by CPU
const top = processes.top(5)
// [{ name: 'node', pid: 1234, cpu: 12.3, mem: 5.6 }, ...]

// Network throughput
console.log(network.rx)  // bytes/sec received
console.log(network.tx)  // bytes/sec transmitted

// System info (static)
console.log(system.hostname)
console.log(system.platform)
console.log(system.uptime)
```

## Reactive hooks

Use these inside JSX components. Each hook polls on an interval and triggers a re-render when data changes. All hooks clean up their intervals on component unmount.

```typescript
import {
    useCpu,
    useMemory,
    useDisk,
    useNetwork,
    useTopProcesses,
    useSystemInfo,
    useHttpHealth,
} from '@termuijs/data'

function CpuMonitor() {
    const cpu = useCpu(500)  // refresh every 500ms
    return <gauge label="CPU" value={cpu.usage / 100} />
}

function SystemDashboard() {
    const cpu  = useCpu(1000)
    const mem  = useMemory(1000)
    const disk = useDisk(5000)
    const top  = useTopProcesses(5, 2000)
    const info = useSystemInfo()  // fetched once; static

    return (
        <Box flexDirection="column">
            <Text>Host: {info.hostname}</Text>
            <Text>CPU: {cpu.usage.toFixed(1)}%</Text>
            <Text>MEM: {(mem.used / mem.total * 100).toFixed(1)}%</Text>
        </Box>
    )
}
```

## HTTP health checks

```typescript
import { useHttpHealth } from '@termuijs/data'

function HealthPanel() {
    const checks = useHttpHealth(
        ['https://api.example.com/health', 'https://db.example.com/ping'],
        5000,  // check every 5 seconds
    )

    return (
        <Box flexDirection="column">
            {checks.map((c) => (
                <Text key={c.url} color={c.status === 200 ? 'green' : 'red'}>
                    {c.url}: {c.status} ({c.latencyMs}ms)
                </Text>
            ))}
        </Box>
    )
}
```

## Hook reference

| Hook | Default interval | Returns |
|------|-----------------|---------|
| `useCpu(ms?)` | 1000ms | `{ usage, cores, model }` |
| `useMemory(ms?)` | 1000ms | `{ used, total, free, percent }` |
| `useDisk(ms?)` | 5000ms | `{ used, total, free, percent }` |
| `useNetwork(ms?)` | 1000ms | `{ rx, tx, interface }` |
| `useTopProcesses(n, ms?)` | 2000ms | `Array<{ name, pid, cpu, mem }>` |
| `useSystemInfo()` | once | `{ hostname, platform, arch, uptime }` |
| `useHttpHealth(urls, ms?)` | 5000ms | `Array<{ url, status, latencyMs }>` |

## Raw collectors vs hooks

Raw collectors (`cpu.percent`, `memory.used`, etc.) do not clean up. Use them in one-shot scripts or outside component trees. Use hooks inside JSX components; they register cleanup on unmount automatically.

## Documentation

Full docs at [www.termui.io/docs/data/overview](https://www.termui.io/docs/data/overview).

## License

MIT
