import EventEmitter from 'events'

export interface ContextState {
    events: EventEmitter
    files: Map<string, ContextFile>
    directories: Map<string, ContextDirectory>
    addFile: (path: string, reason: InclusionReason) => void
    addDirectory: (path: string, reason: InclusionReason) => void
}

export type ContextFile = {
    path: string
    inclusionReasons: InclusionReason[]
}

export type ContextDirectory = {
    path: string
    inclusionReasons: InclusionReason[]
}

export type InclusionReason =
    | { type: 'explicit' }
    | { type: 'tool_use'; toolUseId: string }
    | { type: 'editor'; currentlyOpen: boolean }

export function createContextState(): ContextState {
    const events = new EventEmitter()
    const files = new Map<string, ContextFile>()
    const directories = new Map<string, ContextDirectory>()

    const getOrCreateFile = (path: string) => {
        const file = files.get(path)
        if (file) {
            return file
        }

        const newFile = { path, inclusionReasons: [] }
        files.set(path, newFile)
        return newFile
    }

    const getOrCreateDirectory = (path: string) => {
        const directory = directories.get(path)
        if (directory) {
            return directory
        }

        const newDirectory = { path, inclusionReasons: [] }
        directories.set(path, newDirectory)
        return newDirectory
    }

    const addFile = (path: string, reason: InclusionReason) => {
        const { inclusionReasons: reasons } = getOrCreateFile(path)
        updateInclusionReasons(reasons, reason)
    }

    const addDirectory = (path: string, reason: InclusionReason) => {
        const { inclusionReasons: reasons } = getOrCreateDirectory(path)
        updateInclusionReasons(reasons, reason)
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

    return { events, files, directories, addFile, addDirectory }
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
