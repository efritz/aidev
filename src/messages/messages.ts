export type Response = {
    messages: AssistantMessage[]
}

export type Message = { id: string } & TaggedMessage

export type TaggedMessage =
    | ({ role: 'user' } & UserMessage)
    | ({ role: 'assistant' } & AssistantMessage)
    | ({ role: 'meta' } & MetaMessage)

export type UserMessage = TextMessage | ToolResult
export type AssistantMessage = TextMessage | ToolUseMessage

export type TextMessage = {
    type: 'text'
    content: string
    replayContent?: string
}

export type ToolUseMessage = {
    type: 'tool_use'
    tools: ToolUse[]
}

export type ToolUse = {
    id: string
    name: string
    parameters: string
}

export type ToolResult = {
    type: 'tool_result'
    toolUse: ToolUse
    result?: any
    error?: Error
    canceled?: boolean
}

export type Rule = {
    description: string
    tool: string
    timing: 'pre' | 'post'
    condition: string
    body: string
}

export type MetaMessage =
    | UndoMessage
    | RedoMessage
    | SavepointMessage
    | RollbackMessage
    | BranchMessage
    | SwitchMessage
    | StashMessage
    | UnstashMessage
    | ApplyStashMessage
    | RuleMessage

export type UndoMessage = { type: 'undo' }
export type RedoMessage = { type: 'redo' }
export type SavepointMessage = { type: 'savepoint'; name: string }
export type RollbackMessage = { type: 'rollback'; target: string }
export type BranchMessage = { type: 'branch'; name: string }
export type SwitchMessage = { type: 'switch'; name: string }
export type StashMessage = { type: 'stash'; path: string; content: string; originalContent: string; fromStash: boolean }
export type UnstashMessage = { type: 'unstash'; path: string }
export type ApplyStashMessage = { type: 'applyStash'; path: string; content: string; originalContent: string }
export type RuleMessage = { type: 'rule'; rules: Rule[] }
