import { Dirent } from 'fs'
import { readdir, readFile } from 'fs/promises'
import chokidar, { FSWatcher } from 'chokidar'
import { createIgnoredPathFilterer } from '../util/fs/ignore'

export interface ContextState {
    files: () => Map<string, ContextFile>
    directories: () => Map<string, ContextDirectory>
}

export function createEmptyContextState(): ContextState {
    const files = new Map<string, ContextFile>()
    const directories = new Map<string, ContextDirectory>()

    return {
        files: () => files,
        directories: () => directories,
    }
}

export interface ContextStateManager extends ContextState {
    setFiles: (files: Map<string, ContextFile>) => void
    addFiles: (paths: string | string[], reason: InclusionReason) => Promise<void>
    removeFile: (path: string) => boolean
    setDirectories: (directories: Map<string, ContextDirectory>) => void
    addDirectories: (paths: string | string[], reason: InclusionReason) => Promise<void>
    removeDirectory: (path: string) => boolean
    dispose: () => void
}

export type ContextFile = {
    path: string
    inclusionReasons: InclusionReason[]
    content: string | { error: string }
}

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

export type InclusionReason =
    | { type: 'explicit' }
    | { type: 'tool_use'; toolUseClass: 'read' | 'write'; toolUseId: string }
    | { type: 'editor'; currentlyOpen: boolean }

export async function createContextState(): Promise<ContextStateManager> {
    const files = new Map<string, ContextFile>()
    const directories = new Map<string, ContextDirectory>()
    const watcher = createNewFileWatcher(await createIgnoredPathFilterer())

    return {
        files: () => files,
        setFiles: newFiles => replaceMap(files, newFiles),
        ...createNewFileManager(files, watcher),
        directories: () => directories,
        setDirectories: newDirectories => replaceMap(directories, newDirectories),
        ...createNewDirectoryManager(directories, watcher),
        dispose: () => watcher.close(),
    }
}

function createNewFileWatcher(pathFilterer: (path: string) => boolean): FSWatcher {
    return chokidar.watch([], {
        persistent: true,
        ignoreInitial: false,
        ignored: path => !pathFilterer(path),
    })
}

function createNewFileManager(files: Map<string, ContextFile>, watcher: FSWatcher) {
    const updateFile = async (path: string) => {
        const file = files.get(path)
        if (!file) {
            return
        }

        try {
            file.content = (await readFile(path, 'utf-8')).toString()
        } catch (error: any) {
            file.content = { error: `Error reading file: ${error.message}` }
        }
    }

    watcher.on('all', async (eventName: string, path: string) => updateFile(path))

    const getOrCreateFiles = async (paths: string | string[]): Promise<ContextFile[]> => {
        const newPaths: string[] = []
        const ps = await Promise.all(
            (Array.isArray(paths) ? paths : [paths]).map(async path => {
                const file = files.get(path)
                if (file) {
                    return file
                }

                const newFile: ContextFile = {
                    path,
                    inclusionReasons: [],
                    content: { error: 'File not yet read' },
                }

                files.set(path, newFile)
                await updateFile(path)
                newPaths.push(path)
                return newFile
            }),
        )

        watcher.add(newPaths)
        return ps
    }

    const addFiles = async (paths: string | string[], reason: InclusionReason): Promise<void> => {
        for (const file of await getOrCreateFiles(paths)) {
            const { inclusionReasons } = file
            updateInclusionReasons(inclusionReasons, reason)
        }
    }

    const removeFile = (path: string): boolean => {
        const file = files.get(path)
        if (!file) {
            return false
        }

        files.delete(path)
        watcher.unwatch(path)
        return true
    }

    return {
        addFiles,
        removeFile,
    }
}

function createNewDirectoryManager(directories: Map<string, ContextDirectory>, watcher: FSWatcher) {
    const updateDirectory = async (path: string) => {
        const directory = directories.get(path)
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
                const directory = directories.get(path)
                if (directory) {
                    return directory
                }

                const newDirectory: ContextDirectory = {
                    path,
                    inclusionReasons: [],
                    entries: { error: 'Directory not yet read' },
                }

                directories.set(path, newDirectory)
                await updateDirectory(path)
                newPaths.push(path)
                return newDirectory
            }),
        )

        watcher.add(newPaths)
        return ps
    }

    const addDirectories = async (paths: string | string[], reason: InclusionReason): Promise<void> => {
        for (const directory of await getOrCreateDirectory(paths)) {
            const { inclusionReasons } = directory
            updateInclusionReasons(inclusionReasons, reason)
        }
    }

    const removeDirectory = (path: string): boolean => {
        const directory = directories.get(path)
        if (!directory) {
            return false
        }

        directories.delete(path)
        watcher.unwatch(path)
        return true
    }

    return {
        addDirectories,
        removeDirectory,
    }
}

function updateInclusionReasons(reasons: InclusionReason[], reason: InclusionReason) {
    if (
        (reason.type === 'explicit' && reasons.some(r => r.type === 'explicit')) ||
        (reason.type === 'tool_use' &&
            reasons.some(
                r =>
                    r.type === 'tool_use' && r.toolUseClass === reason.toolUseClass && r.toolUseId === reason.toolUseId,
            ))
    ) {
        // Already exists
        return
    }

    if (reason.type === 'editor') {
        const matching = reasons.find(r => r.type === 'editor')
        if (matching) {
            // Update in-place
            matching.currentlyOpen = reason.currentlyOpen
            return
        }
    }

    // No matching reasons exist
    reasons.push(reason)
}

function replaceMap<K, V>(target: Map<K, V>, source: Map<K, V>) {
    target.clear()
    source.forEach((value, key) => target.set(key, value))
}
