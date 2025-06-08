import { v4 as uuidv4 } from 'uuid'
import { AssistantMessage, Message, MetaMessage, UserMessage } from '../messages/messages'
import { BranchManager, createBranchManager } from './branches'
import { createRuleManager, RulesManager } from './rules'
import { createSavepointManager, SavepointManager } from './savepoints'
import { createStashManager, StashManager } from './stash'
import { createUndoRedoManager, UndoRedoManager } from './undo'

export type ConversationManager = BranchManager &
    UndoRedoManager &
    SavepointManager &
    StashManager &
    RulesManager & {
        messages(): Message[]
        visibleMessages(): Message[]
        messagesFromSavepoint(savepointName: string): Message[]
        setMessages(messages: Message[]): void
        pushUser(message: UserMessage): void
        pushAssistant(message: AssistantMessage): void

        recordLoad(paths: string[]): string
        recordLoadDir(paths: string[]): string
        recordUnload(paths: string[]): string
        recordAddTodo(taskId: string, description: string): string
        recordCompleteTodo(taskId: string): string
        recordCancelTodo(taskId: string): string
        recordSummary(content: string, fromSavepoint?: string): string
    }

export function createConversationManager(): ConversationManager {
    const _messages: Message[] = []
    const messages = () => [..._messages]
    const setMessages = (messages: Message[]) => _messages.splice(0, _messages.length, ...messages)

    const addMessage = (message: Message): string => {
        if (message.role === 'meta' || (message.role === 'user' && message.type === 'text')) {
            saveSnapshot()
        }

        _messages.push(message)

        if (message.role === 'user') {
            removeBranches(childBranches(currentBranch()).map(({ name }) => name))
        }

        return message.id
    }

    const pushMeta = (message: MetaMessage) => addMessage({ ...message, id: uuidv4(), role: 'meta' })
    const pushUser = (message: UserMessage) => addMessage({ ...message, id: uuidv4(), role: 'user' })
    const pushAssistant = (message: AssistantMessage) => addMessage({ ...message, id: uuidv4(), role: 'assistant' })
    const recordLoad = (paths: string[]) => pushMeta({ type: 'load', paths })
    const recordLoadDir = (paths: string[]) => pushMeta({ type: 'loaddir', paths })
    const recordUnload = (paths: string[]) => pushMeta({ type: 'unload', paths })
    const recordAddTodo = (taskId: string, description: string) => pushMeta({ type: 'addTodo', taskId, description })
    const recordCompleteTodo = (taskId: string) => pushMeta({ type: 'completeTodo', taskId })
    const recordCancelTodo = (taskId: string) => pushMeta({ type: 'cancelTodo', taskId })
    const recordSummary = (content: string, fromSavepoint?: string) =>
        pushMeta({ type: 'summary', content, fromSavepoint })
    const { saveSnapshot, ...undoRedoManager } = createUndoRedoManager(messages, setMessages)

    const { branchMetadata, currentBranch, removeBranches, childBranches, ...branchManager } = createBranchManager(
        messages,
        setMessages,
        pushMeta,
        saveSnapshot,
    )

    const visibleMessages = (): Message[] => {
        const allMessages = branchMetadata()[currentBranch()].messages.filter(
            m => !(m.role === 'meta' && m.type === 'switch'),
        )

        // Find the latest summary
        const latestSummaryIndex = allMessages.findLastIndex(m => m.role === 'meta' && m.type === 'summary')
        if (latestSummaryIndex >= 0) {
            const latestSummary = allMessages[latestSummaryIndex] as Message & {
                type: 'summary'
                fromSavepoint?: string
            }

            if (latestSummary.fromSavepoint) {
                // If summarized from a savepoint, keep messages before that savepoint + messages after the summary
                const savepointIndex = allMessages.findIndex(
                    m => m.role === 'meta' && m.type === 'savepoint' && m.name === latestSummary.fromSavepoint,
                )

                if (savepointIndex >= 0) {
                    // Keep messages before savepoint + summary + messages after summary
                    return [...allMessages.slice(0, savepointIndex), ...allMessages.slice(latestSummaryIndex)]
                }
            }

            // If summarized from beginning, only keep messages after the summary
            return allMessages.slice(latestSummaryIndex)
        }

        return allMessages
    }

    const messagesFromSavepoint = (savepointName: string): Message[] => {
        const allMessages = branchMetadata()[currentBranch()].messages.filter(
            m => !(m.role === 'meta' && m.type === 'switch'),
        )

        const savepointIndex = allMessages.findIndex(
            m => m.role === 'meta' && m.type === 'savepoint' && m.name === savepointName,
        )

        if (savepointIndex === -1) {
            return []
        }

        // Return messages from after the savepoint to the end
        return allMessages.slice(savepointIndex + 1)
    }

    const savepointManager = createSavepointManager(
        messages,
        visibleMessages,
        setMessages,
        pushMeta,
        saveSnapshot,
        branchMetadata,
        currentBranch,
        removeBranches,
    )

    return {
        messages,
        visibleMessages,
        messagesFromSavepoint,
        setMessages,
        pushUser,
        pushAssistant,

        recordLoad,
        recordLoadDir,
        recordUnload,
        recordAddTodo,
        recordCompleteTodo,
        recordCancelTodo,
        recordSummary,

        branchMetadata,
        currentBranch,
        ...branchManager,
        ...undoRedoManager,
        ...savepointManager,
        ...createStashManager(visibleMessages, pushMeta),
        ...createRuleManager(pushMeta),
    }
}
