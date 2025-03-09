import { v4 as uuidv4 } from 'uuid'
import { ContextDirectory, ContextFile, ContextState, InclusionReason } from '../context/state'
import { AssistantMessage, Message, MetaMessage, Rule as SerializableRule, UserMessage } from '../messages/messages'
import { Rule } from '../rules/types'
import { extract } from '../util/lists/lists'

export type Conversation<T> = ConversationManager & {
    providerMessages: () => T[]
}

export type Branch = {
    name: string
    parent?: string
    messages: Message[]
}

export type ConversationManager = BranchManager &
    UndoRedoManager &
    SavepointManager &
    StashManager &
    RuleManager & {
        messages(): Message[]
        visibleMessages(): Message[]
        setMessages(messages: Message[]): void

        pushUser(message: UserMessage): string[]
        pushAssistant(message: AssistantMessage): void
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
    const chatMessages: Message[] = []

    const messages = () => chatMessages

    const setMessages = (messages: Message[]) => {
        chatMessages.splice(0, chatMessages.length, ...messages)
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

    const { saveSnapshot, ...undoRedoManager } = createUndoRedoManager(messages, setMessages)

    const { branchMetadata, currentBranch, removeBranches, childBranches, ...branchManager } = createBranchManager(
        pushMeta,
        chatMessages,
        setMessages,
        saveSnapshot,
    )

    const visibleMessages = (): Message[] => {
        return branchMetadata()[currentBranch()].messages.filter(m => !(m.role === 'meta' && m.type === 'switch'))
    }

    const savepointManager = createSavepointManager(
        visibleMessages,
        pushMeta,
        branchMetadata,
        currentBranch,
        saveSnapshot,
        messages,
        setMessages,
        removeBranches,
    )

    const providerMessages = (): T[] => {
        const providerMessages: T[] = []
        if (initialMessage) {
            providerMessages.push(initialMessage)
            postPush?.(providerMessages)
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

                case 'meta':
                    switch (message.type) {
                        case 'rule':
                            providerMessages.push(userMessageToParam(createRuleMessage(message.rules)))
                            break
                    }
            }
        }

        return providerMessages
    }

    return {
        providerMessages,
        messages,
        visibleMessages,
        setMessages,
        pushUser,
        pushAssistant,

        branchMetadata,
        currentBranch,
        ...branchManager,
        ...undoRedoManager,
        ...savepointManager,
        ...createStashManager(visibleMessages, pushMeta),
        ...createRuleManager(pushMeta),
    }
}

type FilesAndDirectories = { files: ContextFile[]; directories: ContextDirectory[] }
const empty: FilesAndDirectories = { files: [], directories: [] }

function injectContextMessages(contextState: ContextState, messages: Message[]): Message[] {
    // Determine the set of file and directories that we want to include in the context for
    // the set of visible messages. There might be other branches that include resources that
    // aren't relevant on this branch. We'll ignore those.
    const visibleToolUseIds = messages.flatMap(m => (m.type === 'tool_use' ? m.tools.map(({ id }) => id) : []))
    const files = [...contextState.files().values()].filter(f => shouldIncludeFile(f, visibleToolUseIds))
    const directories = [...contextState.directories().values()].filter(d =>
        shouldIncludeDirectory(d, visibleToolUseIds),
    )

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

function includedByToolUse(inclusionReasons: InclusionReason[], toolUseIds: string[]): boolean {
    return inclusionReasons.some(reason => reason.type === 'tool_use' && toolUseIds.includes(reason.toolUseId))
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

//
//

interface BranchManager {
    branchMetadata(): Record<string, Branch>
    branches(): string[]
    currentBranch(): string
    branch(name: string): boolean
    switchBranch(name: string): boolean
    renameBranch(oldName: string, newName: string): boolean
    removeBranch(name: string): { success: boolean; prunedBranches: string[] }
}

function createBranchManager(
    pushMeta: (message: MetaMessage) => void,
    chatMessages: Message[] = [],
    setMessages: (messages: Message[]) => void,
    saveSnapshot: () => void,
): BranchManager & {
    removeBranches: (names: string[]) => string[]
    childBranches: (name: string) => Branch[]
} {
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
        branchMetadata,
        branches,
        currentBranch,
        branch,
        switchBranch,
        renameBranch,
        removeBranch,
        removeBranches,
        childBranches,
    }
}

//
//

interface UndoRedoManager {
    undo(): boolean
    redo(): boolean
}

function createUndoRedoManager(
    messages: () => Message[],
    setMessages: (messages: Message[]) => void,
): UndoRedoManager & {
    saveSnapshot: () => void
} {
    const undoStack: Message[][] = []
    const redoStack: Message[][] = []

    const undo = (): boolean => {
        if (undoStack.length === 0) {
            return false
        }

        redoStack.push([...messages()])
        setMessages(undoStack.pop()!)
        return true
    }

    const redo = (): boolean => {
        if (redoStack.length === 0) {
            return false
        }

        undoStack.push([...messages()])
        setMessages(redoStack.pop()!)
        return true
    }

    const saveSnapshot = (): void => {
        undoStack.push([...messages()])
        redoStack.length = 0
    }

    return {
        undo,
        redo,
        saveSnapshot,
    }
}

//
//

interface SavepointManager {
    savepoints(): string[]
    addSavepoint(name: string): boolean
    rollbackToSavepoint(name: string): { success: boolean; prunedBranches: string[] }
}

function createSavepointManager(
    visibleMessages: () => Message[],
    pushMeta: (message: MetaMessage) => void,
    branchMetadata: () => Record<string, Branch>,
    currentBranch: () => string,
    saveSnapshot: () => void,
    messages: () => Message[],
    setMessages: (messages: Message[]) => void,
    removeBranches: (names: string[]) => string[],
): SavepointManager {
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
        setMessages(messages().filter(message => !messageIdsToRemove.includes(message.id)))
        pushMeta({ type: 'switch', name: branchName })
        return { success: true, prunedBranches }
    }

    return {
        savepoints,
        addSavepoint,
        rollbackToSavepoint,
    }
}

//
//

interface StashManager {
    stashedFiles(): Map<string, string>
    stashFile(path: string, content: string, originalContent: string, fromStash: boolean): void
    unstashFile(path: string): boolean
    applyStashedFile(path: string, content: string, originalContents: string): void
}

function createStashManager(visibleMessages: () => Message[], pushMeta: (message: MetaMessage) => void): StashManager {
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

    return {
        stashedFiles,
        stashFile,
        unstashFile,
        applyStashedFile,
    }
}

//
//

interface RuleManager {
    addRules(rules: Rule[]): void
}

function createRuleManager(pushMeta: (message: MetaMessage) => void): RuleManager {
    const addRules = (rules: Rule[]): void => {
        pushMeta({
            type: 'rule',
            rules: rules.map(({ matcher, ...rest }) => ({
                ...rest,
                condition: matcher.condition(),
            })),
        })
    }

    return { addRules }
}
