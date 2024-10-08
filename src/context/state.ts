import EventEmitter from 'events'
import { Dirent } from 'fs'
import { readdir, readFile } from 'fs/promises'
import chokidar from 'chokidar'

export interface ContextState {
    files: Map<string, ContextFile>
    directories: Map<string, ContextDirectory>
}

export function createEmptyContextState(): ContextState {
    return {
        files: new Map<string, ContextFile>(),
        directories: new Map<string, ContextDirectory>(),
    }
}

export interface ContextStateManager extends ContextState {
    events: EventEmitter
    dispose: () => void
    addFile: (path: string, reason: InclusionReason) => Promise<void>
    addDirectory: (path: string, reason: InclusionReason) => Promise<void>
    removeFile: (path: string) => boolean
    removeDirectory: (path: string) => boolean
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
    | { type: 'tool_use'; toolUseId: string }
    | { type: 'editor'; currentlyOpen: boolean }

export function createContextState(): ContextStateManager {
    const events = new EventEmitter()
    const watcher = chokidar.watch([], { persistent: true, ignoreInitial: false })
    const dispose = () => watcher.close()

    const updateFile = async (path: string) => {
        const file = files.get(path)
        if (file) {
            try {
                file.content = (await readFile(path, 'utf-8')).toString()
            } catch (error: any) {
                file.content = { error: `Error reading file: ${error.message}` }
            }

            events.emit('change', path)
        }
    }

    const updateDirectory = async (path: string) => {
        const directory = directories.get(path)
        if (directory) {
            try {
                directory.entries = (await readdir(path, { withFileTypes: true })).map((entry: Dirent) => ({
                    name: entry.name,
                    isFile: entry.isFile(),
                    isDirectory: entry.isDirectory(),
                }))
            } catch (error: any) {
                directory.entries = { error: `Error reading directory: ${error.message}` }
            }

            events.emit('change', path)
        }
    }

    watcher.on('all', async (eventName: string, path: string) => updateFile(path))
    watcher.on('all', async (eventName: string, path: string) => updateDirectory(path))

    const files = new Map<string, ContextFile>()
    const directories = new Map<string, ContextDirectory>()

    const getOrCreateFile = async (path: string): Promise<ContextFile> => {
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
        watcher.add(path)
        await updateFile(path)
        return newFile
    }

    const getOrCreateDirectory = async (path: string): Promise<ContextDirectory> => {
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
        watcher.add(path)
        await updateDirectory(path)
        return newDirectory
    }

    const addFile = async (path: string, reason: InclusionReason): Promise<void> => {
        const { inclusionReasons } = await getOrCreateFile(path)
        updateInclusionReasons(inclusionReasons, reason)
    }

    const addDirectory = async (path: string, reason: InclusionReason): Promise<void> => {
        const { inclusionReasons } = await getOrCreateDirectory(path)
        updateInclusionReasons(inclusionReasons, reason)
    }

    const removeFile = (path: string): boolean => {
        const file = files.get(path)
        if (!file) {
            return false
        }

        files.delete(path)
        watcher.unwatch(path)
        events.emit('remove', path)
        return true
    }

    const removeDirectory = (path: string): boolean => {
        const directory = directories.get(path)
        if (!directory) {
            return false
        }

        directories.delete(path)
        watcher.unwatch(path)
        events.emit('remove', path)
        return true
    }

    const updateInclusionReasons = (reasons: InclusionReason[], reason: InclusionReason) => {
        if (
            (reason.type === 'explicit' && reasons.some(r => r.type === 'explicit')) ||
            (reason.type === 'tool_use' && reasons.some(r => r.type === 'tool_use' && r.toolUseId === reason.toolUseId))
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

    return {
        events,
        dispose,
        files,
        directories,
        addFile,
        addDirectory,
        removeFile,
        removeDirectory,
    }
}

export function shouldIncludeFile(file: ContextFile, visibleToolUses: string[]): boolean {
    return shouldInclude(file.inclusionReasons, visibleToolUses)
}

export function shouldIncludeDirectory(directory: ContextDirectory, visibleToolUses: string[]): boolean {
    return shouldInclude(directory.inclusionReasons, visibleToolUses)
}

function shouldInclude(reasons: InclusionReason[], visibleToolUses: string[]): boolean {
    for (const reason of reasons) {
        switch (reason.type) {
            case 'explicit':
                return true

            // case 'tool_use':
            //     if (visibleToolUses.includes(reason.toolUseId)) {
            //         return true
            //     }

            //     break

            case 'editor':
                if (reason.currentlyOpen) {
                    return true
                }

                break
        }
    }

    return false
}

export function includedByToolUse(inclusionReasons: InclusionReason[], toolUseIds: string[]): boolean {
    return inclusionReasons.some(reason => reason.type === 'tool_use' && toolUseIds.includes(reason.toolUseId))
}
