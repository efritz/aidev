import { readFile } from 'fs/promises'
import { dirname } from 'path'
import { FSWatcher } from 'chokidar'
import { InclusionReason, updateInclusionReasons } from './reason'

export type ContextFile = {
    path: string
    inclusionReasons: InclusionReason[]
    content: Promise<string | { error: string }>
}

export function createNewFileManager(
    watcher: FSWatcher,
    { addDirectories }: { addDirectories: (paths: string[], inclusionReason: InclusionReason) => void },
) {
    const _files = new Map<string, ContextFile>()

    const fileContents = async (path: string): ContextFile['content'] => {
        try {
            return (await readFile(path, 'utf-8')).toString()
        } catch (err: any) {
            return { error: `Error reading file: ${err.message}` }
        }
    }

    const updateFile = (path: string) => {
        const file = _files.get(path)
        if (file) {
            file.content = fileContents(path)
        }
    }

    const updateAllFiles = () => {
        for (const [path, file] of _files.entries()) {
            file.content = fileContents(path)
        }
    }

    watcher.on('all', (_event: string, path: string) => updateFile(path))

    const getOrCreateFiles = (paths: string[]): ContextFile[] => {
        const newPaths: string[] = []
        const files = paths.map(path => {
            const file = _files.get(path)
            if (file) {
                file.content = fileContents(path)
                return file
            }

            const newFile: ContextFile = {
                path,
                inclusionReasons: [],
                content: fileContents(path),
            }

            _files.set(path, newFile)
            newPaths.push(path)
            return newFile
        })

        watcher.add(newPaths)
        return files
    }

    const files = () => new Map(_files)

    const addFiles = (rawPaths: string | string[], reason: InclusionReason): void => {
        const paths = Array.isArray(rawPaths) ? rawPaths : [rawPaths]
        addDirectories(Array.from(new Set(paths.map(path => dirname(path)))), reason)

        for (const file of getOrCreateFiles(paths)) {
            const { inclusionReasons } = file
            updateInclusionReasons(inclusionReasons, reason)
        }
    }

    return {
        files,
        addFiles,
        updateAllFiles,
    }
}
