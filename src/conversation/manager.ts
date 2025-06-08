import { v4 as uuidv4 } from 'uuid'
import { AssistantMessage, Message, MetaMessage, SummaryMessage, UserMessage } from '../messages/messages'
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
        // Get raw stream of visible messages with switch meta messages filtered out
        let messages = branchMetadata()[currentBranch()].messages.filter(
            m => !(m.role === 'meta' && m.type === 'switch'),
        )

        // Extract all summary messages we need to process
        const summaries = messages
            .map((message, index) => ({ message, index }))
            .filter(({ message }) => message.role === 'meta' && message.type === 'summary')
            .map(({ message, index }) => {
                const { fromSavepoint } = message as SummaryMessage

                const savepointIndex = fromSavepoint
                    ? messages.findIndex(m => m.role === 'meta' && m.type === 'savepoint' && m.name === fromSavepoint)
                    : undefined

                return {
                    rangeStart: savepointIndex ? savepointIndex + 1 : 0,
                    rangeEnd: index,
                }
            })

        // Only keep the summaries that are not contained by a later summary
        const validSummaries = summaries.filter(({ rangeStart }, i) => {
            for (let j = i + 1; j < summaries.length; j++) {
                if (rangeStart >= summaries[j].rangeStart && rangeStart < summaries[j].rangeEnd) {
                    return false
                }
            }

            return true
        })

        // Process summaries in reverse order. This will maintain the indices for
        // the non-overlapping summary messages that occur earlier in the conversation.
        for (let i = validSummaries.length - 1; i >= 0; i--) {
            const { rangeStart, rangeEnd } = validSummaries[i]
            const summarizedRange = messages.slice(rangeStart, rangeStart)
            const extractedMetaMessages = summarizedRange.filter(m => m.role === 'meta')

            messages = [
                ...messages.slice(0, rangeStart),
                messages[rangeEnd],
                ...extractedMetaMessages,
                ...messages.slice(rangeEnd + 1),
            ]
        }

        return messages
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
