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

        pushUser(message: UserMessage): void
        pushAssistant(message: AssistantMessage): void
    }

export function createConversationManager(): ConversationManager {
    const _messages: Message[] = []
    const messages = () => _messages
    const setMessages = (messages: Message[]) => _messages.splice(0, _messages.length, ...messages)

    const addMessage = (message: Message): void => {
        if (message.role === 'meta' || (message.role === 'user' && message.type === 'text')) {
            saveSnapshot()
        }

        _messages.push(message)

        if (message.role === 'user') {
            removeBranches(childBranches(currentBranch()).map(({ name }) => name))
        }
    }

    const pushMeta = (message: MetaMessage) => addMessage({ ...message, id: uuidv4(), role: 'meta' })
    const pushUser = (message: UserMessage) => addMessage({ ...message, id: uuidv4(), role: 'user' })
    const pushAssistant = (message: AssistantMessage) => addMessage({ ...message, id: uuidv4(), role: 'assistant' })

    const { saveSnapshot, ...undoRedoManager } = createUndoRedoManager(messages, setMessages)

    const { branchMetadata, currentBranch, removeBranches, childBranches, ...branchManager } = createBranchManager(
        messages,
        setMessages,
        pushMeta,
        saveSnapshot,
    )

    const visibleMessages = (): Message[] => {
        return branchMetadata()[currentBranch()].messages.filter(m => !(m.role === 'meta' && m.type === 'switch'))
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
