import EventEmitter from 'events'

export type ContextState = {
    events: EventEmitter
    files: Map<string, ContextFile>
    openFiles: string[]
}

export type ContextFile = {
    path: string
    inclusionReasons: InclusionReason[]
}

export type InclusionReason =
    | { type: 'explicit' }
    | { type: 'editor'; currentlyVisible: boolean }
    | { type: 'assistant_tool_use'; toolName: string; messageId: string }
