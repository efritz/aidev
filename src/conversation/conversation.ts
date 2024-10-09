import { v4 as uuidv4 } from 'uuid'
import {
    ContextDirectory,
    ContextFile,
    ContextState,
    includedByToolUse,
    shouldIncludeDirectory,
    shouldIncludeFile,
} from '../context/state'
import { AssistantMessage, Message, MetaMessage, UserMessage } from '../messages/messages'
import { extract } from '../util/lists/lists'

export type Conversation<T> = ConversationManager & {
    providerMessages: () => T[]
}

export type Branch = {
    name: string
    parent?: string
    messages: Message[]
}

export type ConversationManager = {
    messages(): Message[]
    visibleMessages(): Message[]
    setMessages(messages: Message[]): void

    pushUser(message: UserMessage): string[]
    pushAssistant(message: AssistantMessage): void

    savepoints(): string[]
    addSavepoint(name: string): boolean
    rollbackToSavepoint(name: string): { success: boolean; prunedBranches: string[] }

    stashedFiles(): Map<string, string>
    stashFile(path: string, content: string, originalContent: string, fromStash: boolean): void
    unstashFile(path: string): boolean
    applyStashedFile(path: string, content: string, originalContents: string): void

    undo(): boolean
    redo(): boolean

    branchMetadata(): Record<string, Branch>
    branches(): string[]
    currentBranch(): string
    branch(name: string): boolean
    switchBranch(name: string): boolean
    renameBranch(oldName: string, newName: string): boolean
    removeBranch(name: string): { success: boolean; prunedBranches: string[] }
}

type ConversationOptions<T> = {
    contextState: ContextState
    userMessageToParam: (message: UserMessage) => T
    assistantMessagesToParam: (messages: AssistantMessage[]) => T
    initialMessage?: T
    postPush?: (MessageChannel: T[]) => void
}

export function createConversation<T>({
    contextState,
    userMessageToParam,
    assistantMessagesToParam,
    initialMessage,
    postPush,
}: ConversationOptions<T>): Conversation<T> {
    let chatMessages: Message[] = []
    const undoStack: Message[][] = []
    const redoStack: Message[][] = []

    const setMessages = (messages: Message[]) => {
        chatMessages = messages
    }

    const saveSnapshot = (): void => {
        undoStack.push([...chatMessages])
        redoStack.length = 0
    }

    const branchMetadata = (): Record<string, Branch> => {
        const branches: Record<string, Branch> = { main: { name: 'main', messages: [] } }

        let currentBranch = 'main'
        for (const message of chatMessages) {
            if (message.role === 'meta') {
                switch (message.type) {
                    case 'branch':
                        const name = message.name
                        const parent = currentBranch
                        branches[parent].messages.push(message)
                        const messages = [...branches[parent].messages]

                        currentBranch = message.name
                        branches[currentBranch] = { name, parent, messages }
                        continue

                    case 'switch':
                        currentBranch = message.name
                        break
                }
            }

            branches[currentBranch].messages.push(message)
        }

        return branches
    }

    const visibleMessages = (): Message[] => {
        return branchMetadata()[currentBranch()].messages.filter(m => !(m.role === 'meta' && m.type === 'switch'))
    }

    const providerMessages = (): T[] => {
        const providerMessages: T[] = []
        if (initialMessage) {
            providerMessages.push(initialMessage)
        }

        for (const message of injectContextMessages(contextState, visibleMessages())) {
            switch (message.role) {
                case 'user':
                    providerMessages.push(userMessageToParam(message))
                    postPush?.(providerMessages)
                    break

                case 'assistant':
                    providerMessages.push(assistantMessagesToParam([message]))
                    postPush?.(providerMessages)
                    break
            }
        }

        return providerMessages
    }

    const addMessage = (message: Message) => {
        if (isUndoTarget(message)) {
            saveSnapshot()
        }

        setMessages([...chatMessages, message])
    }

    const pushMeta = (message: MetaMessage) => {
        addMessage({ ...message, id: uuidv4(), role: 'meta' })
    }

    const pushUser = (message: UserMessage): string[] => {
        addMessage({ ...message, id: uuidv4(), role: 'user' })
        return removeBranches(childBranches(currentBranch()).map(({ name }) => name))
    }

    const pushAssistant = (message: AssistantMessage) => {
        addMessage({ ...message, id: uuidv4(), role: 'assistant' })
    }

    const savepoints = (): string[] => {
        return visibleMessages()
            .filter(message => message.role === 'meta' && message.type === 'savepoint')
            .map(message => message.name)
    }

    const addSavepoint = (name: string): boolean => {
        if (savepoints().includes(name)) {
            return false
        }

        pushMeta({ type: 'savepoint', name })
        return true
    }

    const stashedFiles = (): Map<string, string> => {
        const stash = new Map<string, string>()
        for (const message of visibleMessages()) {
            if (message.role === 'meta') {
                if (message.type === 'stash') {
                    stash.set(message.path, message.content)
                } else if (message.type === 'unstash' || message.type === 'applyStash') {
                    stash.delete(message.path)
                }
            }
        }
        return stash
    }

    const stashFile = (path: string, content: string, originalContent: string, fromStash: boolean) => {
        pushMeta({ type: 'stash', path, content, originalContent, fromStash })
        return true
    }

    const unstashFile = (path: string): boolean => {
        if (!stashedFiles().has(path)) {
            return false
        }

        pushMeta({ type: 'unstash', path })
        return true
    }

    const applyStashedFile = (path: string, content: string, originalContent: string): boolean => {
        if (!stashedFiles().has(path)) {
            return false
        }

        pushMeta({ type: 'applyStash', path, content, originalContent })
        return true
    }

    const rollbackToSavepoint = (name: string): { success: boolean; prunedBranches: string[] } => {
        const isMatchingSavepoint = (message: Message): boolean =>
            message.role === 'meta' && message.type === 'savepoint' && message.name === name

        const branches = branchMetadata()
        const visibleMessages = branches[currentBranch()].messages

        const messageIdsToRemove: string[] = []
        const children: string[] = []
        let foundMatchingSavepoint = false

        for (const message of visibleMessages) {
            if (isMatchingSavepoint(message)) {
                foundMatchingSavepoint = true
            }

            if (foundMatchingSavepoint) {
                if (message.role === 'meta' && message.type === 'branch') {
                    children.push(message.name)
                }

                messageIdsToRemove.push(message.id)
            }
        }

        if (!foundMatchingSavepoint) {
            return { success: false, prunedBranches: [] }
        }

        let branchName: string = currentBranch()
        while (true) {
            const parent = branches[branchName].parent
            if (parent && branches[parent].messages.some(isMatchingSavepoint)) {
                branchName = parent
            } else {
                break
            }
        }

        saveSnapshot()
        const prunedBranches = removeBranches(children)
        setMessages(chatMessages.filter(message => !messageIdsToRemove.includes(message.id)))
        pushMeta({ type: 'switch', name: branchName })
        return { success: true, prunedBranches }
    }

    const isUndoTarget = (message: Message): boolean => {
        switch (message.role) {
            case 'meta':
                return true

            case 'user':
                return message.type === 'text'
        }

        return false
    }

    const undo = (): boolean => {
        if (undoStack.length === 0) {
            return false
        }

        redoStack.push([...chatMessages])
        setMessages(undoStack.pop()!)
        return true
    }

    const redo = (): boolean => {
        if (redoStack.length === 0) {
            return false
        }

        undoStack.push([...chatMessages])
        setMessages(redoStack.pop()!)
        return true
    }

    const branches = (): string[] => {
        return Object.keys(branchMetadata())
    }

    const childBranches = (name: string): Branch[] => {
        const branches = branchMetadata()
        return Object.values(branches).filter(branch => branch.parent === name)
    }

    const currentBranch = () => {
        for (let i = chatMessages.length - 1; i >= 0; i--) {
            const message = chatMessages[i]

            if (message.role === 'meta' && (message.type === 'branch' || message.type === 'switch')) {
                return message.name
            }
        }

        return 'main'
    }

    const branch = (name: string): boolean => {
        if (branches().includes(name)) {
            return false
        }

        pushMeta({ type: 'branch', name })
        return true
    }

    const switchBranch = (name: string): boolean => {
        if (!branches().includes(name)) {
            return false
        }

        pushMeta({ type: 'switch', name })
        return true
    }

    const renameBranch = (oldName: string, newName: string): boolean => {
        if (!branches().includes(oldName) || branches().includes(newName)) {
            return false
        }

        const renameBranchMessage = (message: Message): Message => {
            if (message.role === 'meta') {
                if (message.type === 'branch' || message.type === 'switch') {
                    if (message.name === oldName) {
                        return { ...message, name: newName }
                    }
                }
            }

            return message
        }

        saveSnapshot()
        setMessages(chatMessages.map(renameBranchMessage))
        return true
    }

    const removeBranch = (name: string): { success: boolean; prunedBranches: string[] } => {
        if (!branches().includes(name) || name === 'main') {
            return { success: false, prunedBranches: [] }
        }

        const bx = branchMetadata()
        let newBranchName: string | undefined = undefined
        let b = currentBranch()
        while (true) {
            const br = bx[b].parent
            if (!br) {
                break
            }

            if (b === name) {
                newBranchName = br
                break
            }
            b = br
        }

        saveSnapshot()
        const prunedBranches = doRemoveBranch(name)
        if (newBranchName) {
            pushMeta({ type: 'switch', name: newBranchName })
        }
        return { success: true, prunedBranches }
    }

    const doRemoveBranch = (name: string): string[] => {
        const children = removeBranches(childBranches(name).map(({ name }) => name))
        removeBranchMessages(name)
        return [name, ...children]
    }

    const removeBranches = (names: string[]): string[] => {
        const removed: string[] = []
        for (const name of names) {
            removed.push(...doRemoveBranch(name))
        }

        return removed
    }

    const removeBranchMessages = (name: string): void => {
        const branch = branchMetadata()[name]
        if (branch) {
            const branchIds = branch.messages.map(m => m.id)
            const parentIds = branch.parent ? branchMetadata()[branch.parent].messages.map(m => m.id) : []
            const uniqueIds = branchIds.filter(id => !parentIds.includes(id))

            const createMessage = chatMessages.find(m => m.role === 'meta' && m.type === 'branch' && m.name === name)
            const idsToRemove = [...uniqueIds, ...(createMessage ? [createMessage.id] : [])]

            setMessages(chatMessages.filter(m => !idsToRemove.includes(m.id)))
        }
    }

    return {
        providerMessages,
        messages: () => chatMessages,
        visibleMessages,
        setMessages,
        pushUser,
        pushAssistant,
        savepoints,
        addSavepoint,
        rollbackToSavepoint,
        stashedFiles,
        stashFile,
        unstashFile,
        applyStashedFile,
        undo,
        redo,
        branchMetadata,
        branches,
        currentBranch,
        branch,
        switchBranch,
        renameBranch,
        removeBranch,
    }
}

type FilesAndDirectories = { files: ContextFile[]; directories: ContextDirectory[] }
const empty: FilesAndDirectories = { files: [], directories: [] }

function injectContextMessages(contextState: ContextState, messages: Message[]): Message[] {
    // Determine the set of file and directories that we want to include in the context for
    // the set of visible messages. There might be other branches that include resources that
    // aren't relevant on this branch. We'll ignore those.
    const visibleToolUseIds = messages.flatMap(m => (m.type === 'tool_use' ? m.tools.map(({ id }) => id) : []))
    const files = [...contextState.files.values()].filter(f => shouldIncludeFile(f, visibleToolUseIds))
    const directories = [...contextState.directories.values()].filter(d => shouldIncludeDirectory(d, visibleToolUseIds))

    // A map from target index int he message list to the set of files and directories that should
    // be included at that index. We'll build this up by iterating the messages, then interlace the
    // context messages with the user messages to create a new visible message list.
    const contextByIndex = new Map<number, FilesAndDirectories>()

    // Iterate the visible messages from back to front. For each message, we'll determine if
    // it references a relevant file or directory and stash that resource to be inserted before
    // the next user message. Once we stash a resource we remove it from the list of candidates
    // so that it's only included once.
    //
    // Loop invariants:
    //   - i is the index of the current message
    //   - j is the index of the most recent user message we've seen
    for (let i = messages.length - 1, j = messages.length; i >= 0; i--) {
        const message = messages[i]

        // Update the index of the "closest" user message for subsequent iterations.
        if (message.role === 'user' && message.type === 'text') {
            j = i
        }

        // Determine the set of files and directories that are referenced by this tool use.
        // Remove them from the list of candidates, and insert them into the index mapping
        // with the index of the most recently seen user message.
        if (message.role === 'assistant' && message.type === 'tool_use') {
            const ids = message.tools.map(({ id }) => id)
            const { files: oldFiles, directories: oldDirectories } = contextByIndex.get(j) ?? empty
            const newFiles = extract(files, f => includedByToolUse(f.inclusionReasons, ids))
            const newDirectories = extract(directories, d => includedByToolUse(d.inclusionReasons, ids))

            contextByIndex.set(j, {
                files: [...oldFiles, ...newFiles],
                directories: [...oldDirectories, ...newDirectories],
            })
        }
    }

    // Include any remaining relevant files and directories at the beginning of the conversation.
    contextByIndex.set(0, {
        files: files.filter(f => shouldIncludeFile(f, [])),
        directories: directories.filter(d => shouldIncludeDirectory(d, [])),
    })

    // Build context messages and inject any non-empty ones into the message list at the target index.
    return messages.flatMap((message, index) => {
        const { files, directories } = contextByIndex.get(index) ?? empty
        const contextMessage = createContextMessage(files, directories)
        return contextMessage ? [contextMessage, message] : [message]
    })
}

const fence = '```'

function createContextMessage(
    referencedFiles: ContextFile[],
    referencedDirectories: ContextDirectory[],
): Message | undefined {
    if (referencedFiles.length == 0 && referencedDirectories.length === 0) {
        return undefined
    }

    const payloads: string[] = []
    const normalizedFiles = referencedFiles.map(({ path, content: payload }) => ({ path, payload }))
    const normalizedDirectories = referencedDirectories.map(({ path, entries: payload }) => ({ path, payload }))

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
