import chokidar, { FSWatcher } from 'chokidar'

export async function withFileWatcher<T>(path: string, f: (watcher: FSWatcher) => Promise<T>): Promise<T> {
    const watcher = chokidar.watch(path, {
        persistent: true,
        ignoreInitial: true,
    })

    try {
        return await f(watcher)
    } finally {
        watcher.close()
    }
}
