import { Message, MetaMessage } from '../messages/messages'

export type BranchManager = Omit<ReturnType<typeof createBranchManager>, 'removeBranches' | 'childBranches'>

export type Branch = {
    name: string
    parent?: string
    messages: Message[]
}

export function createBranchManager(
    pushMeta: (message: MetaMessage) => void,
    chatMessages: Message[] = [],
    setMessages: (messages: Message[]) => void,
    saveSnapshot: () => void,
) {
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
