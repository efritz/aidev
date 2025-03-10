import { Dirent } from 'fs'
import { readdir } from 'fs/promises'
import { FSWatcher } from 'chokidar'
import { InclusionReason, updateInclusionReasons } from './reason'
import { replaceMap } from './util'

export type ContextDirectory = {
    path: string
    inclusionReasons: InclusionReason[]
    entries: DirectoryEntry[] | { error: string }
}

export type DirectoryEntry = {
    name: string
    isFile: boolean
    isDirectory: boolean
}

export function createNewDirectoryManager(watcher: FSWatcher) {
    const _directories = new Map<string, ContextDirectory>()

    const updateDirectory = async (path: string) => {
        const directory = _directories.get(path)
        if (!directory) {
            return
        }

        try {
            directory.entries = (await readdir(path, { withFileTypes: true })).map((entry: Dirent) => ({
                name: entry.name,
                isFile: entry.isFile(),
                isDirectory: entry.isDirectory(),
            }))
        } catch (error: any) {
            directory.entries = { error: `Error reading directory: ${error.message}` }
        }
    }

    watcher.on('all', async (eventName: string, path: string) => updateDirectory(path))

    const getOrCreateDirectory = async (paths: string | string[]): Promise<ContextDirectory[]> => {
        const newPaths: string[] = []
        const ps = await Promise.all(
            (Array.isArray(paths) ? paths : [paths]).map(async path => {
                const directory = _directories.get(path)
                if (directory) {
                    return directory
                }

                const newDirectory: ContextDirectory = {
                    path,
                    inclusionReasons: [],
                    entries: { error: 'Directory not yet read' },
                }

                _directories.set(path, newDirectory)
                await updateDirectory(path)
                newPaths.push(path)
                return newDirectory
            }),
        )

        watcher.add(newPaths)
        return ps
    }

    const directories = () => new Map(_directories)
    const setDirectories = (newDirectories: Map<string, ContextDirectory>) => replaceMap(_directories, newDirectories)

    const addDirectories = async (paths: string | string[], reason: InclusionReason): Promise<void> => {
        for (const directory of await getOrCreateDirectory(paths)) {
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
        setDirectories,
        addDirectories,
        removeDirectory,
    }
}
