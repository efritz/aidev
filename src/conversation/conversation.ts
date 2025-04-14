import { v4 as uuidv4 } from 'uuid'
import { ContextDirectory } from '../context/directories'
import { ContextFile } from '../context/files'
import { InclusionReason } from '../context/reason'
import { ContextState } from '../context/state'
import { AssistantMessage, Message, Rule as SerializableRule, UserMessage } from '../messages/messages'
import { extract } from '../util/lists/lists'
import { ConversationManager, createConversationManager } from './manager'

export type Conversation<T> = ConversationManager & {
    providerMessages: () => T[]
}

type ConversationOptions<T> = {
    contextState: ContextState
    userMessageToParam: (message: UserMessage) => T[]
    assistantMessagesToParam: (messages: AssistantMessage[]) => T[]
    initialMessage?: T[]
    postPush?: (MessageChannel: T[]) => void
}

export function createConversation<T>({
    contextState,
    userMessageToParam,
    assistantMessagesToParam,
    initialMessage,
    postPush,
}: ConversationOptions<T>): Conversation<T> {
    const { visibleMessages, ...conversationManager } = createConversationManager()

    const providerMessages = (): T[] => {
        const providerMessages: T[] = []

        const addMessages = (messages: T[]) => {
            messages.forEach(message => {
                providerMessages.push(message)
                postPush?.(providerMessages)
            })
        }

        if (initialMessage) {
            addMessages(initialMessage)
        }

        for (const message of injectContextMessages(contextState, visibleMessages())) {
            switch (message.role) {
                case 'user':
                    addMessages(userMessageToParam(message))
                    break

                case 'assistant':
                    addMessages(assistantMessagesToParam([message]))
                    break

                case 'meta':
                    switch (message.type) {
                        case 'rule':
                            addMessages(userMessageToParam(createRuleMessage(message.rules)))
                            break
                    }
            }
        }

        return providerMessages
    }

    return {
        visibleMessages,
        ...conversationManager,
        providerMessages,
    }
}

//
//

type FilesAndDirectories = { files: ContextFile[]; directories: ContextDirectory[] }
const empty: FilesAndDirectories = { files: [], directories: [] }

// TODO - I think we need to consider applied stashed files as well

function injectContextMessages(contextState: ContextState, messages: Message[]): Message[] {
    // Determine the set of file and directories that we want to include in the context for
    // the set of visible messages. There might be other branches that include resources that
    // aren't relevant on this branch. We'll ignore those.
    const visibleToolUseIds = messages.flatMap(m => (m.type === 'tool_use' ? m.tools.map(({ id }) => id) : []))
    const files = [...contextState.files().values()].filter(f => shouldIncludeFile(f, visibleToolUseIds))
    const directories = [...contextState.directories().values()].filter(d =>
        shouldIncludeDirectory(d, visibleToolUseIds),
    )

    // A map from target index in the message list to the set of files and directories that should
    // be included at that index. We'll build this up by iterating the messages, then interlace the
    // context messages with the user messages to create a new visible message list.
    const contextByIndex = new Map<number, FilesAndDirectories>()

    // Iterate the visible messages from back to front. For each message, we'll determine if
    // it references a relevant file or directory and stash that resource to be inserted directly
    // after the linked tool result message. Once we stash a resource we remove it from the list
    // of candidates so that it's only included once.
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i]

        // Update the index of the "closest" user message for subsequent iterations.
        if (message.role === 'user' && message.type === 'tool_result') {
            const newFiles = extract(files, f => includedByToolUse(f.inclusionReasons, [message.toolUse.id]))
            const newDirectories = extract(directories, d =>
                includedByToolUse(d.inclusionReasons, [message.toolUse.id]),
            )

            contextByIndex.set(i + 1, {
                files: newFiles,
                directories: newDirectories,
            })
        }
    }

    // Include any remaining relevant files and directories at the beginning of the conversation.
    contextByIndex.set(0, {
        files: files.filter(f => shouldIncludeFile(f, [])),
        directories: directories.filter(d => shouldIncludeDirectory(d, [])),
    })

    // Build context messages and inject them in the correct location in the message list. We do
    // this by adding a context message directly before the message that requires it and flattening
    // the resulting list. We need to pad the initial list with a trailing undefined message so that
    // a context message after the last message has a place to be inserted. Lastly, undefined values
    // are filtered from the flattened result.
    return [...messages, undefined]
        .flatMap((message, index) => [createContextMessage(contextByIndex.get(index) ?? empty), message])
        .filter(message => !!message)
}

const fence = '```'

function createContextMessage({ files, directories }: FilesAndDirectories): Message | undefined {
    if (files.length === 0 && directories.length === 0) {
        return undefined
    }

    const payloads: string[] = []
    const normalizedFiles = files.map(({ path, content: payload }) => ({ path, payload }))
    const normalizedDirectories = directories.map(({ path, entries: payload }) => ({ path, payload }))

    for (const [path, content] of sortPayloadsByPath(normalizedFiles)) {
        if (typeof content === 'string') {
            payloads.push(`Current contents of file "${path}":\n${fence}\n${content}\n${fence}`)
        } else {
            payloads.push(`Failed to load the contents of file "${path}": ${content.error}`)
        }
    }

    for (const [path, entries] of sortPayloadsByPath(normalizedDirectories)) {
        if (!('error' in entries)) {
            const serialized = JSON.stringify(entries, null, 2)
            payloads.push(`Current entries of directory "${path}":\n${serialized}`)
        } else {
            payloads.push(`Failed to load the entries of directory "${path}": ${entries.error}`)
        }
    }

    return {
        id: uuidv4(),
        role: 'user',
        type: 'text',
        content: 'Project context has been updated.\n\n' + payloads.join('\n'),
    }
}

function sortPayloadsByPath<T>(payloads: { path: string; payload: T }[]): [string, T][] {
    const m = new Map<string, T>()
    for (const { path, payload } of payloads) {
        m.set(path, payload)
    }

    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function includedByToolUse(inclusionReasons: InclusionReason[], toolUseIds: string[]): boolean {
    return inclusionReasons.some(reason => reason.type === 'tool_use' && toolUseIds.includes(reason.toolUseId))
}

export function shouldIncludeFile(file: ContextFile, visibleToolUses: string[]): boolean {
    return shouldInclude(file.inclusionReasons, visibleToolUses)
}

function shouldIncludeDirectory(directory: ContextDirectory, visibleToolUses: string[]): boolean {
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

//
//

function createRuleMessage(rules: SerializableRule[]): UserMessage {
    const payloads: string[] = []
    for (const rule of rules) {
        const activation = `Activated ${rule.timing === 'pre' ? 'before' : 'after'} the use of ${rule.tool} when ${rule.condition}`
        payloads.push(`## ${rule.description}\n\n${activation}\n\n${rule.body}`)
    }

    return {
        type: 'text',
        content: 'Active rules have been updated.\n\n' + payloads.join('\n'),
    }
}
