import EventEmitter from 'events'
import { Dirent } from 'fs'
import { readdir, readFile } from 'fs/promises'
import chokidar from 'chokidar'

export interface ContextState {
    events: EventEmitter
    dispose: () => void
    files: Map<string, ContextFile>
    directories: Map<string, ContextDirectory>
    addFile: (path: string, reason: InclusionReason) => void
    addDirectory: (path: string, reason: InclusionReason) => void
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

export function createContextState(): ContextState {
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

    const getOrCreateFile = (path: string) => {
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
        updateFile(path)
        return newFile
    }

    const getOrCreateDirectory = (path: string) => {
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
        updateDirectory(path)
        return newDirectory
    }

    const addFile = (path: string, reason: InclusionReason) => {
        const { inclusionReasons } = getOrCreateFile(path)
        updateInclusionReasons(inclusionReasons, reason)
    }

    const addDirectory = (path: string, reason: InclusionReason) => {
        const { inclusionReasons } = getOrCreateDirectory(path)
        updateInclusionReasons(inclusionReasons, reason)
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

    return { events, dispose, files, directories, addFile, addDirectory }
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

            case 'tool_use':
                if (visibleToolUses.includes(reason.toolUseId)) {
                    return true
                }

                break

            case 'editor':
                if (reason.currentlyOpen) {
                    return true
                }

                break
        }
    }

    return false
}
