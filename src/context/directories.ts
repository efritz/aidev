import { Dirent } from 'fs'
import { readdir } from 'fs/promises'
import { dirname } from 'path'
import { FSWatcher } from 'chokidar'
import { InclusionReason, updateInclusionReasons } from './reason'

export type ContextDirectory = {
    path: string
    inclusionReasons: InclusionReason[]
    entries: Promise<DirectoryEntry[] | { error: string }>
}

export type DirectoryEntry = {
    name: string
    isFile: boolean
    isDirectory: boolean
}

export function createNewDirectoryManager(watcher: FSWatcher) {
    const _directories = new Map<string, ContextDirectory>()

    const directoryContents = async (path: string): ContextDirectory['entries'] => {
        try {
            return (await readdir(path, { withFileTypes: true })).map((entry: Dirent) => ({
                name: entry.name,
                isFile: entry.isFile(),
                isDirectory: entry.isDirectory(),
            }))
        } catch (err: any) {
            return { error: `Error reading directory: ${err.message}` }
        }
    }

    const updateDirectory = (path: string) => {
        const directory = _directories.get(path)
        if (!directory) {
            return
        }

        directory.entries = directoryContents(path)
    }

    watcher.on('all', (event: string, path: string) =>
        updateDirectory(['addDir', 'unlinkDir'].includes(event) ? path : dirname(path)),
    )

    const getOrCreateDirectory = (paths: string | string[]): ContextDirectory[] => {
        const newPaths: string[] = []
        const ps = (Array.isArray(paths) ? paths : [paths]).map(path => {
            const directory = _directories.get(path)
            if (directory) {
                return directory
            }

            const newDirectory: ContextDirectory = {
                path,
                inclusionReasons: [],
                entries: directoryContents(path),
            }

            _directories.set(path, newDirectory)
            newPaths.push(path)
            return newDirectory
        })

        watcher.add(newPaths)
        return ps
    }

    const directories = () => new Map(_directories)

    const addDirectories = (paths: string | string[], reason: InclusionReason): void => {
        for (const directory of getOrCreateDirectory(paths)) {
            const { inclusionReasons } = directory
            updateInclusionReasons(inclusionReasons, reason)
        }
    }

    const removeDirectory = (path: string): boolean => {
        const directory = _directories.get(path)
        if (!directory) {
            return false
        }

        _directories.delete(path)
        watcher.unwatch(path)
        return true
    }

    return {
        directories,
        addDirectories,
        removeDirectory,
    }
}
