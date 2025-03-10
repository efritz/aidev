import { Message, MetaMessage } from '../messages/messages'
import { Branch } from './branches'

export type SavepointManager = ReturnType<typeof createSavepointManager>

export function createSavepointManager(
    messages: () => Message[],
    visibleMessages: () => Message[],
    setMessages: (messages: Message[]) => void,
    pushMeta: (message: MetaMessage) => void,
    saveSnapshot: () => void,
    branchMetadata: () => Record<string, Branch>,
    currentBranch: () => string,
    removeBranches: (names: string[]) => string[],
) {
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
