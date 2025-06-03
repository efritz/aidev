import { createIgnoredPathFilterer } from '../util/fs/ignore'
import { ContextDirectory, createNewDirectoryManager } from './directories'
import { ContextFile, createNewFileManager } from './files'
import { createNewFileWatcher } from './watcher'

type FileManager = ReturnType<typeof createNewFileManager>
type DirectoryManager = ReturnType<typeof createNewDirectoryManager>
export type ContextStateManager = FileManager & DirectoryManager & { dispose: () => void }

export async function createContextState(): Promise<ContextStateManager> {
    const { watcher, dispose } = createNewFileWatcher(await createIgnoredPathFilterer())
    const directoryManager = createNewDirectoryManager(watcher)
    const fileManager = createNewFileManager(watcher, directoryManager)

    return { dispose, ...fileManager, ...directoryManager }
}

export type ContextState = Pick<ContextStateManager, 'files' | 'directories'>

export function createEmptyContextState(): ContextState {
    const files = new Map<string, ContextFile>()
    const directories = new Map<string, ContextDirectory>()

    return {
        files: () => files,
        directories: () => directories,
    }
}
