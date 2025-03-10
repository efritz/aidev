import chokidar, { FSWatcher } from 'chokidar'

export function createNewFileWatcher(pathFilterer: (path: string) => boolean): {
    watcher: FSWatcher
    dispose: () => void
} {
    const watcher = chokidar.watch([], {
        persistent: true,
        ignoreInitial: false,
        ignored: path => !pathFilterer(path),
    })

    return {
        watcher,
        dispose: () => watcher.close(),
    }
}
