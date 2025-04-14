import { Message, MetaMessage } from '../messages/messages'

export type StashManager = ReturnType<typeof createStashManager>

export function createStashManager(visibleMessages: () => Message[], pushMeta: (message: MetaMessage) => string) {
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

    const applyStashedFile = (path: string, content: string, originalContent: string): string => {
        if (!stashedFiles().has(path)) {
            throw new Error(`No stashed file found for path: ${path}`)
        }

        return pushMeta({ type: 'applyStash', path, content, originalContent })
    }

    return {
        stashedFiles,
        stashFile,
        unstashFile,
        applyStashedFile,
    }
}
