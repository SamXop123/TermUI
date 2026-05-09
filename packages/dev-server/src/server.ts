// ─────────────────────────────────────────────────────
// Dev Server — orchestrates hot-reload + DevTools
//
// Forks the user's entry file as a child process.
// When a file change is detected, the child is killed
// and respawned, giving the effect of "hot reload".
// ─────────────────────────────────────────────────────

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fork, type ChildProcess } from 'node:child_process';
import { FileWatcher, type FileChange } from './watcher.js';
import { DevTools } from './devtools.js';

export interface DevServerOptions {
    /** Project root directory */
    rootDir: string;
    /** Directories to watch (relative to rootDir) */
    watchDirs?: string[];
    /** Entry file (relative to rootDir or absolute) */
    entry?: string;
    /** Callback on reload */
    onReload?: (change: FileChange) => void;
    /** Whether to show DevTools */
    devTools?: boolean;
    /** Extra Node.js flags to pass to the child process */
    nodeFlags?: string[];
    /** Debounce interval in ms before killing/respawning (default: 200) */
    debounce?: number;
}

export class DevServer {
    private _watcher: FileWatcher;
    private _devtools: DevTools;
    private _rootDir: string;
    private _running = false;
    private _reloadCount = 0;
    private _onReload?: (change: FileChange) => void;

    // ── Child process management ──
    private _child: ChildProcess | null = null;
    private _entryFile: string | null = null;
    private _nodeFlags: string[];
    private _debounce: number;
    private _reloadTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(options: DevServerOptions) {
        this._rootDir = resolve(options.rootDir);
        this._onReload = options.onReload;
        this._nodeFlags = options.nodeFlags ?? [];
        this._debounce = options.debounce ?? 200;

        // Resolve entry file
        if (options.entry) {
            this._entryFile = resolve(this._rootDir, options.entry);
        } else {
            // Auto-detect common entry points
            for (const candidate of ['src/index.tsx', 'src/index.ts', 'src/main.tsx', 'src/main.ts', 'index.ts']) {
                const fullPath = resolve(this._rootDir, candidate);
                if (existsSync(fullPath)) {
                    this._entryFile = fullPath;
                    break;
                }
            }
        }

        const watchDirs = (options.watchDirs ?? ['src', 'screens', 'themes']).map(d => resolve(this._rootDir, d));
        this._watcher = new FileWatcher(watchDirs);
        this._devtools = new DevTools();

        this._watcher.onChange(change => {
            this._reloadCount++;
            this._handleChange(change);
        });

        this._watcher.onError(err => {
            console.error(`[termui] Watch error: ${err.message}`);
        });
    }

    get devtools(): DevTools { return this._devtools; }
    get reloadCount(): number { return this._reloadCount; }
    get isRunning(): boolean { return this._running; }
    get childProcess(): ChildProcess | null { return this._child; }

    /** Start the dev server — spawns the entry file and begins watching */
    start(): void {
        if (this._running) return;
        this._running = true;

        console.log();
        console.log('  ⚡ TermUI Dev Server');
        console.log(`  📁 ${this._rootDir}`);
        if (this._entryFile) {
            console.log(`  🚀 Entry: ${this._entryFile}`);
        }
        console.log('  👀 Watching for changes...');
        console.log('  F12 toggles DevTools');
        console.log();

        this._watcher.start();

        // Spawn the initial child process
        if (this._entryFile) {
            this._spawnChild();
        }
    }

    /** Stop the dev server — kills child process and stops watching */
    stop(): void {
        this._running = false;
        this._killChild();
        this._watcher.stop();
        if (this._reloadTimer) {
            clearTimeout(this._reloadTimer);
            this._reloadTimer = null;
        }
        console.log('\n  Dev server stopped.\n');
    }

    // ── Child process lifecycle ──

    /**
     * Spawn the entry file as a child process using `fork()`.
     * The child inherits stdout/stderr for seamless terminal output.
     */
    private _spawnChild(): void {
        if (!this._entryFile) return;

        try {
            this._child = fork(this._entryFile, [], {
                cwd: this._rootDir,
                stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
                execArgv: [...this._nodeFlags, '--loader', 'tsx'],
                env: {
                    ...process.env,
                    TERMUI_DEV: '1',
                    NODE_ENV: 'development',
                },
            });

            this._child.on('exit', (code, signal) => {
                if (this._running && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
                    // Unexpected exit — log it
                    const time = new Date().toLocaleTimeString();
                    console.log(`  ❌ [${time}] Process exited (code: ${code}, signal: ${signal})`);
                    this._devtools.logEvent('crash', `exit code ${code}`);
                }
                this._child = null;
            });

            this._child.on('error', (err) => {
                console.error(`  ❌ Process error: ${err.message}`);
                this._devtools.logEvent('error', err.message);
                this._child = null;
            });

            // Listen for IPC messages from the child (for DevTools integration)
            this._child.on('message', (msg: any) => {
                if (msg?.type === 'devtools') {
                    this._devtools.logEvent(msg.event, msg.data);
                }
            });
        } catch (err) {
            console.error(`  ❌ Failed to spawn: ${(err as Error).message}`);
        }
    }

    /**
     * Gracefully kill the running child process.
     * Sends SIGTERM first. If it doesn't exit within 2 seconds, sends SIGKILL.
     */
    private _killChild(): void {
        if (!this._child) return;

        const child = this._child;
        this._child = null;

        // Try graceful shutdown first
        child.kill('SIGTERM');

        // Force-kill after timeout if still alive
        const forceKillTimer = setTimeout(() => {
            try {
                child.kill('SIGKILL');
            } catch {
                // Already dead
            }
        }, 2000);

        child.once('exit', () => {
            clearTimeout(forceKillTimer);
        });
    }

    /**
     * Handle file changes: kill the current child and respawn.
     * Uses a debounce to coalesce rapid successive changes.
     */
    private _handleChange(change: FileChange): void {
        const time = new Date().toLocaleTimeString();
        const icon = change.type === 'tss' ? '🎨' : change.type === 'config' ? '⚙️' : '📝';
        console.log(`  ${icon} [${time}] ${change.filename} changed — reloading...`);

        this._devtools.logEvent('reload', `${change.type}: ${change.filename}`);
        this._onReload?.(change);

        // Debounce the restart
        if (this._reloadTimer) {
            clearTimeout(this._reloadTimer);
        }
        this._reloadTimer = setTimeout(async () => {
            this._reloadTimer = null;
            // Graceful reload: notify the child via IPC so it can unmount
            // cleanly (flush fibers, close alt-screen, etc.) before we kill it.
            // IPC is available because we use fork() with the 'ipc' stdio channel.
            if (this._child && this._child.connected) {
                try {
                    this._child.send({ type: 'reload' });
                } catch {
                    // channel already closed — fall through to hard kill
                }
                // Give the child up to 200 ms to handle the message and exit
                await new Promise<void>(r => setTimeout(r, 200));
            }
            this._killChild();
            // Small delay to let the old process exit
            setTimeout(() => {
                if (this._running && this._entryFile) {
                    this._spawnChild();
                    const respawnTime = new Date().toLocaleTimeString();
                    console.log(`  🔄 [${respawnTime}] Respawned`);
                }
            }, 100);
        }, this._debounce);
    }
}

export { FileWatcher, DevTools };
export type { FileChange };
