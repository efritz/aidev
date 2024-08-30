import EventEmitter from 'events'

export interface ContextState {
    events: EventEmitter
    files: Map<string, ContextFile>
    addFile: (path: string, reason: InclusionReason) => void
}

export type ContextFile = {
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

    const getOrCreateFile = (path: string) => {
        const file = files.get(path)
        if (file) {
            return file
        }

        const newFile = { path, inclusionReasons: [] }
        files.set(path, newFile)
        return newFile
    }

    const addFile = (path: string, reason: InclusionReason) => {
        const { inclusionReasons: reasons } = getOrCreateFile(path)

        if (
            (reason.type === 'explicit' && reasons.some(r => r.type === 'explicit')) ||
            (reason.type === 'tool_use' && reasons.some(r => r.type === 'tool_use' && r.messageId === reason.messageId))
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

    return { events, files, addFile }
}

export function shouldIncludeFile(file: ContextFile, visibleToolUses: string[]): boolean {
    for (const reason of file.inclusionReasons) {
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