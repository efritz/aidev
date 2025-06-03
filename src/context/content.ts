import { ConversationManager } from '../conversation/manager'
import { ContextDirectory } from './directories'
import { ContextFile } from './files'
import { ContextState } from './state'

export function getActiveFiles(conversationManager: ConversationManager, contextState: ContextState): ContextFile[] {
    const allFiles = contextState.files()
    const activeFiles = new Map<string, ContextFile>()

    const addAll = (files: (ContextFile | undefined)[]) => {
        for (const file of files) {
            if (file) {
                activeFiles.set(file.path, file)
            }
        }
    }

    for (const message of conversationManager.visibleMessages()) {
        switch (message.type) {
            case 'load':
                addAll(message.paths.map(path => allFiles.get(path)))
                break

            case 'unload':
                message.paths.forEach(path => activeFiles.delete(path))
                break

            case 'tool_use':
                const toolIds = message.tools.map(t => t.id)
                const includedByToolUse = ({ inclusionReasons }: ContextFile) =>
                    inclusionReasons.some(r => r.type === 'tool_use' && toolIds.includes(r.toolUseId))
                addAll([...allFiles.values()].filter(includedByToolUse))
                break
        }
    }

    return [...activeFiles.values()]
}

export function getActiveDirectories(
    conversationManager: ConversationManager,
    contextState: ContextState,
): ContextDirectory[] {
    const allDirectories = contextState.directories()
    const activeDirectories = new Map<string, ContextDirectory>()

    const addAll = (directories: (ContextDirectory | undefined)[]) => {
        for (const directory of directories) {
            if (directory) {
                activeDirectories.set(directory.path, directory)
            }
        }
    }

    for (const message of conversationManager.visibleMessages()) {
        switch (message.type) {
            case 'loaddir':
                addAll(message.paths.map(path => allDirectories.get(path)))
                break

            case 'unload':
                message.paths.forEach(path => activeDirectories.delete(path))
                break

            case 'tool_use':
                const toolIds = message.tools.map(t => t.id)
                const includedByToolUse = ({ inclusionReasons }: ContextDirectory) =>
                    inclusionReasons.some(r => r.type === 'tool_use' && toolIds.includes(r.toolUseId))
                addAll([...allDirectories.values().filter(includedByToolUse)])
                break
        }
    }

    return [...activeDirectories.values()]
}
