import { readFile } from 'fs/promises'
import { FSWatcher } from 'chokidar'
import { InclusionReason, updateInclusionReasons } from './reason'
import { replaceMap } from './util'

export type ContextFile = {
    path: string
    inclusionReasons: InclusionReason[]
    content: string | { error: string }
}

export function createNewFileManager(watcher: FSWatcher) {
    const _files = new Map<string, ContextFile>()

    const updateFile = async (path: string) => {
        const file = _files.get(path)
        if (!file) {
            return
        }

        try {
            file.content = (await readFile(path, 'utf-8')).toString()
        } catch (error: any) {
            file.content = { error: `Error reading file: ${error.message}` }
        }
    }

    watcher.on('all', async (eventName: string, path: string) => updateFile(path))

    const getOrCreateFiles = async (paths: string | string[]): Promise<ContextFile[]> => {
        const newPaths: string[] = []
        const ps = await Promise.all(
            (Array.isArray(paths) ? paths : [paths]).map(async path => {
                const file = _files.get(path)
                if (file) {
                    return file
                }

                const newFile: ContextFile = {
                    path,
                    inclusionReasons: [],
                    content: { error: 'File not yet read' },
                }

                _files.set(path, newFile)
                await updateFile(path)
                newPaths.push(path)
                return newFile
            }),
        )

        watcher.add(newPaths)
        return ps
    }

    const files = () => new Map(_files)
    const setFiles = (newFiles: Map<string, ContextFile>) => replaceMap(_files, newFiles)

    const addFiles = async (paths: string | string[], reason: InclusionReason): Promise<void> => {
        for (const file of await getOrCreateFiles(paths)) {
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
        setFiles,
        addFiles,
        removeFile,
    }
}
