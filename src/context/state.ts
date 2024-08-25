import EventEmitter from 'events'

export interface ContextState {
    events: EventEmitter
    files: Map<string, ContextFile>
    addFile: (path: string, reason: InclusionReason) => void
    openFiles: string[]
}

export type ContextFile = {
    path: string
    inclusionReasons: InclusionReason[]
}

export type InclusionReason =
    | { type: 'explicit' }
    | { type: 'editor'; currentlyVisible: boolean }
    | { type: 'assistant_tool_use'; messageId: string }

export function createContextState(): ContextState {
    const events = new EventEmitter()
    const files = new Map<string, ContextFile>()

    const addFile = (path: string, reason: InclusionReason) => {
        let file = files.get(path)
        if (!file) {
            file = { path, inclusionReasons: [] }
            files.set(path, file)
        }

        const existingReasonIndex = file.inclusionReasons.findIndex(r => r.type === reason.type)

        if (existingReasonIndex !== -1) {
            if (reason.type === 'explicit') {
            } else if (reason.type === 'editor') {
                file.inclusionReasons[existingReasonIndex] = reason
            } else if (reason.type === 'assistant_tool_use') {
                if (
                    !file.inclusionReasons.some(
                        r => r.type === 'assistant_tool_use' && r.messageId === reason.messageId,
                    )
                ) {
                    file.inclusionReasons.push(reason)
                }
            }
        } else {
            file.inclusionReasons.push(reason)
        }
    }

    return { events, files, addFile, openFiles: [] }
}
