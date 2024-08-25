import EventEmitter from 'events'

export interface ContextState {
    events: EventEmitter
    files: Map<string, ContextFile>
    addFile: (path: string, reason: InclusionReason) => void
    openFiles: string[]
}

export type ContextFile = {
    path: string
    inclusionReasons: Set<InclusionReason>
}

export type InclusionReason =
    | { type: 'explicit' }
    | { type: 'editor'; currentlyVisible: boolean }
    | { type: 'assistant_tool_use'; messageId: string }

export function createContextState(): ContextState {
    const events = new EventEmitter()
    const files = new Map<string, ContextFile>()

    const getOrCreateFile = (path: string) => {
        const file = files.get(path)
        if (file) {
            return file
        }

        const newFile = { path, inclusionReasons: new Set<InclusionReason>() }
        files.set(path, newFile)
        return newFile
    }

    const addFile = (path: string, reason: InclusionReason) => {
        const { inclusionReasons: reasons } = getOrCreateFile(path)
        reasons.add(reason)

        if (reason.type === 'editor') {
            // We only want the most recent reason for editor visibility.
            // Remote the inverse entry if it exists in the set for this file.
            reasons.delete({ type: 'editor', currentlyVisible: !reason.currentlyVisible })
        }
    }

    return { events, files, addFile, openFiles: [] }
}
