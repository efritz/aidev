import { v4 as uuidv4 } from 'uuid'
import { getActiveDirectories, getActiveFiles } from '../context/conversation'
import { ContextDirectory } from '../context/directories'
import { ContextFile } from '../context/files'
import { InclusionReason } from '../context/reason'
import { ContextState } from '../context/state'
import { ApplyStashMessage, AssistantMessage, Message, RuleMessage, UserMessage } from '../messages/messages'
import { ConversationManager, createConversationManager } from './manager'

export type Conversation<T> = ConversationManager & {
    providerMessages: () => Promise<T[]>
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
    const conversationManager = createConversationManager()

    const providerMessages = async (): Promise<T[]> => {
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

        for (const message of await injectContextMessages(conversationManager, contextState)) {
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
                            addMessages(userMessageToParam(createRuleMessage(message)))
                            break

                        case 'applyStash':
                            addMessages(userMessageToParam(createStashAppliedMessage(message)))
                    }
            }
        }

        return providerMessages
    }

    return {
        ...conversationManager,
        providerMessages,
    }
}

//
//

type FilesAndDirectories = {
    files: ContextFile[]
    directories: ContextDirectory[]
}

async function injectContextMessages(
    conversationManager: ConversationManager,
    contextState: ContextState,
): Promise<Message[]> {
    // Determine the set of file and directories that we want to include in the context for
    // the set of visible messages. There might be other branches that include resources that
    // aren't relevant on this branch. We'll ignore those.
    const messages = conversationManager.visibleMessages()
    const files = getActiveFiles(conversationManager, contextState)
    const directories = getActiveDirectories(conversationManager, contextState)

    // This is a map from target position in the message list to the set of files and directories
    // that should be included (or mentioned) at that index. We'll build this up by iterating the
    // messages, then interlace the context messages with the user messages to create a new visible
    // message list.
    const contextByIndex = new Map<number, FilesAndDirectories>()

    const seenFile = new Set<string>()
    const seenDirectory = new Set<string>()

    // Iterate the visible messages from back to front. For each message, we'll determine if it
    // references a relevant file or directory and stash that resource to be inserted directly
    // after the linked tool result message. Once we stash a resource we mark it as included so
    // we only include the full content once.
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i]

        const references: FilesAndDirectories = {
            files: [],
            directories: [],
        }

        const addFile = (f: ContextFile) => {
            if (!seenFile.has(f.path)) {
                seenFile.add(f.path)
                references.files.push(f)
            }
        }

        const addDirectory = (d: ContextDirectory) => {
            if (!seenDirectory.has(d.path)) {
                seenDirectory.add(d.path)
                references.directories.push(d)
            }
        }

        if (message.role === 'user' && message.type === 'tool_result') {
            const shouldInclude = ({ inclusionReasons }: { inclusionReasons: InclusionReason[] }) => {
                return includedByToolUse(inclusionReasons, message.toolUse.id)
            }

            files.filter(shouldInclude).forEach(addFile)
            directories.filter(shouldInclude).forEach(addDirectory)
        }

        if (message.role === 'meta') {
            if (message.type === 'applyStash') {
                files.filter(f => includedByAppliedStash(f.inclusionReasons, message.id)).forEach(addFile)
            }

            if (message.type === 'load') {
                files.filter(f => message.paths.includes(f.path)).forEach(addFile)
            }

            if (message.type === 'loaddir') {
                directories.filter(d => message.paths.includes(d.path)).forEach(addDirectory)
            }
        }

        contextByIndex.set(i + 1, references)
    }

    // Include any remaining relevant files and directories at the beginning of the conversation.
    contextByIndex.set(0, {
        files: files.filter(f => !seenFile.has(f.path)),
        directories: directories.filter(d => !seenDirectory.has(d.path)),
    })

    // Build context messages and inject them in the correct location in the message list. We do
    // this by adding a context message directly before the message that requires it and flattening
    // the resulting list. We need to pad the initial list with a trailing undefined message so that
    // a context message after the last message has a place to be inserted. Lastly, undefined values
    // are filtered from the flattened result.
    return (
        await Promise.all(
            [...messages, undefined].map(async (message, index) => [
                await createContextMessage(contextByIndex.get(index) ?? {}),
                message,
            ]),
        )
    )
        .flat()
        .filter(message => !!message)
}

const fence = '```'

async function createContextMessage({
    files = [],
    directories = [],
}: Partial<FilesAndDirectories>): Promise<Message | undefined> {
    if (files.length === 0 && directories.length === 0) {
        return undefined
    }

    const payloads: string[] = []
    const normalizedFiles = await Promise.all(
        files.map(async ({ path, content: payload }) => ({ path, payload: await payload })),
    )
    const normalizedDirectories = await Promise.all(
        directories.map(async ({ path, entries: payload }) => ({ path, payload: await payload })),
    )

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

function includedByToolUse(inclusionReasons: InclusionReason[], toolUseId: string): boolean {
    return inclusionReasons.some(reason => reason.type === 'tool_use' && reason.toolUseId === toolUseId)
}

function includedByAppliedStash(inclusionReasons: InclusionReason[], metaMessageId: string): boolean {
    return inclusionReasons.some(reason => reason.type === 'stash_applied' && reason.metaMessageId === metaMessageId)
}

//
//

function createRuleMessage({ rules }: RuleMessage): UserMessage {
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

function createStashAppliedMessage({ path }: ApplyStashMessage): UserMessage {
    return {
        type: 'text',
        content: `Wrote a stashed version of "${path}" to disk.`,
    }
}
