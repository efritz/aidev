import { Dirent } from 'fs'
import { readdir } from 'fs/promises'
import { dirname } from 'path'
import { FSWatcher } from 'chokidar'
import { normalizeDirectoryPath } from '../util/fs/normalize'
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
        path = normalizeDirectoryPath(path)

        const directory = _directories.get(path)
        if (directory) {
            directory.entries = directoryContents(path)
        }
    }

    const updateAllDirectories = () => {
        for (const [path, directory] of _directories.entries()) {
            directory.entries = directoryContents(path)
        }
    }

    watcher.on('all', (event: string, path: string) =>
        updateDirectory(['addDir', 'unlinkDir'].includes(event) ? path : dirname(path)),
    )

    const getOrCreateDirectory = (paths: string[]): ContextDirectory[] => {
        const newPaths: string[] = []
        const directories = paths.map(path => {
            const directory = _directories.get(path)
            if (directory) {
                directory.entries = directoryContents(path)
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
        return directories
    }

    const directories = () => new Map(_directories)

    const addDirectories = (rawPaths: string | string[], reason: InclusionReason): void => {
        const paths = Array.isArray(rawPaths) ? rawPaths : [rawPaths]

        for (const directory of getOrCreateDirectory(paths)) {
            const { inclusionReasons } = directory
            updateInclusionReasons(inclusionReasons, reason)
        }
    }

    return {
        directories,
        addDirectories,
        updateAllDirectories,
    }
}
