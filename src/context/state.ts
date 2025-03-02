import { Dirent } from 'fs'
import { readdir, readFile } from 'fs/promises'
import chokidar from 'chokidar'
import { Rule } from '../rules/types'
import { createIgnoredPathFilterer } from '../util/fs/ignore'

export interface ContextState {
    rules: Rule[]
    files: Map<string, ContextFile>
    directories: Map<string, ContextDirectory>
}

export function createEmptyContextState(): ContextState {
    return {
        rules: [],
        files: new Map<string, ContextFile>(),
        directories: new Map<string, ContextDirectory>(),
    }
}

export interface ContextStateManager extends ContextState {
    dispose: () => void
    addRule: (rule: Rule) => Promise<void>
    addFiles: (paths: string | string[], reason: InclusionReason) => Promise<void>
    addDirectories: (paths: string | string[], reason: InclusionReason) => Promise<void>
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
    | { type: 'tool_use'; toolUseClass: 'read' | 'write'; toolUseId: string }
    | { type: 'editor'; currentlyOpen: boolean }

export async function createContextState(): Promise<ContextStateManager> {
    const pathFilterer = await createIgnoredPathFilterer()

    const watcher = chokidar.watch([], { persistent: true, ignoreInitial: false, ignored: path => !pathFilterer(path) })
    const dispose = () => watcher.close()

    const rules: Rule[] = []
    const files = new Map<string, ContextFile>()
    const directories = new Map<string, ContextDirectory>()

    const updateFileOrDirectory = (path: string) => Promise.all([updateFile(path), updateDirectory(path)])

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

    watcher.on('all', async (eventName: string, path: string) => updateFileOrDirectory(path))

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

    const addRule = async (rule: Rule): Promise<void> => {
        rules.push(rule)
    }

    const addFiles = async (paths: string | string[], reason: InclusionReason): Promise<void> => {
        for (const file of await getOrCreateFiles(paths)) {
            const { inclusionReasons } = file
            updateInclusionReasons(inclusionReasons, reason)
        }
    }

    const addDirectories = async (paths: string | string[], reason: InclusionReason): Promise<void> => {
        for (const directory of await getOrCreateDirectory(paths)) {
            const { inclusionReasons } = directory
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

    const removeDirectory = (path: string): boolean => {
        const directory = directories.get(path)
        if (!directory) {
            return false
        }

        directories.delete(path)
        watcher.unwatch(path)
        return true
    }

    const updateInclusionReasons = (reasons: InclusionReason[], reason: InclusionReason) => {
        if (
            (reason.type === 'explicit' && reasons.some(r => r.type === 'explicit')) ||
            (reason.type === 'tool_use' &&
                reasons.some(
                    r =>
                        r.type === 'tool_use' &&
                        r.toolUseClass === reason.toolUseClass &&
                        r.toolUseId === reason.toolUseId,
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

    return {
        dispose,
        rules,
        files,
        directories,
        addRule,
        addFiles,
        addDirectories,
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

            case 'tool_use':
                // If we ONLY write to a file we don't need to include it. We only want to include
                // a file if it's explicitly read by a tool. We keep the 'write' tool use class to
                // ensure that we always include the file contents after the last modification so
                // the assistant doesn't get confused about the current state of the contents.
                if (reason.toolUseClass === 'read' && visibleToolUses.includes(reason.toolUseId)) {
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

export function includedByToolUse(inclusionReasons: InclusionReason[], toolUseIds: string[]): boolean {
    return inclusionReasons.some(reason => reason.type === 'tool_use' && toolUseIds.includes(reason.toolUseId))
}
