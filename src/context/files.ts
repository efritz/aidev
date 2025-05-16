import { readFile } from 'fs/promises'
import { FSWatcher } from 'chokidar'
import { InclusionReason, updateInclusionReasons } from './reason'

export type ContextFile = {
    path: string
    inclusionReasons: InclusionReason[]
    content: Promise<string | { error: string }>
}

export function createNewFileManager(watcher: FSWatcher) {
    const _files = new Map<string, ContextFile>()

    const fileContents = async (path: string): ContextFile['content'] => {
        try {
            return (await readFile(path, 'utf-8')).toString()
        } catch (err: any) {
            return { error: `Error reading file: ${err.message}` }
        }
    }

    const updateFile = async (path: string) => {
        const file = _files.get(path)
        if (!file) {
            return
        }

        file.content = fileContents(path)
    }

    watcher.on('all', async (_event: string, path: string) => updateFile(path))

    const getOrCreateFiles = (paths: string | string[]): ContextFile[] => {
        const newPaths: string[] = []
        const ps = (Array.isArray(paths) ? paths : [paths]).map(path => {
            const file = _files.get(path)
            if (file) {
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
        return ps
    }

    const files = () => new Map(_files)

    const addFiles = (paths: string | string[], reason: InclusionReason): void => {
        for (const file of getOrCreateFiles(paths)) {
            const { inclusionReasons } = file
            updateInclusionReasons(inclusionReasons, reason)
        }
    }

    const removeFile = (path: string): boolean => {
        const file = _files.get(path)
        if (!file) {
            return false
        }

        _files.delete(path)
        watcher.unwatch(path)
        return true
    }

    return {
        files,
        addFiles,
        removeFile,
    }
}
