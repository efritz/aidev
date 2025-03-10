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
        setMessages(messages: Message[]): void

        pushUser(message: UserMessage): string[]
        pushAssistant(message: AssistantMessage): void
    }

export function createConversationManager(): ConversationManager {
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

    return {
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
