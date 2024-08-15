import { Dirent } from 'fs'
import { readdir, readFile } from 'fs/promises'
import chalk from 'chalk'
import { prefixFormatter, ProgressResult, withProgress } from '../progress/progress'

export type DirectoryPayload = {
    path: string
    entries: {
        name: string
        isFile: boolean
        isDirectory: boolean
    }[]
}

export async function readDirectoryContents(paths: string[]): Promise<ProgressResult<DirectoryPayload[]>> {
    return readFilesystem<DirectoryPayload>(
        paths,
        async path => ({
            entries: (await readdir(path, { withFileTypes: true })).map((entry: Dirent) => ({
                name: entry.name,
                isFile: entry.isFile(),
                isDirectory: entry.isDirectory(),
            })),
        }),
        ({ path, entries }) => `${chalk.dim('ℹ')} Read directory "${chalk.red(path)}" (${entries.length} entries).`,
        {
            progressPrefix: 'Reading directories into context...',
            successPrefix: 'Read directories into context.',
            failurePrefix: 'Directory read failed.',
        },
    )
}

export type FilePayload = {
    path: string
    contents: string
}

export async function readFileContents(paths: string[]): Promise<ProgressResult<FilePayload[]>> {
    return readFilesystem<FilePayload>(
        paths,
        async path => ({ contents: (await readFile(path, 'utf-8')).toString() }),
        ({ path }) => `${chalk.dim('ℹ')} Read file "${chalk.red(path)}".`,
        {
            progressPrefix: 'Reading files into context...',
            successPrefix: 'Read files into context.',
            failurePrefix: 'File read failed.',
        },
    )
}

async function readFilesystem<T extends { path: string }>(
    paths: string[],
    read: (path: string) => Promise<Omit<T, 'path'>>,
    progressFormatter: (payload: T) => string,
    options: {
        progressPrefix: string
        successPrefix: string
        failurePrefix: string
    },
): Promise<ProgressResult<T[]>> {
    const formatSnapshot = (snapshot?: T[]) =>
        (snapshot || [])
            .sort(({ path: a }, { path: b }) => a.localeCompare(b))
            .map(progressFormatter)
            .join('\n')

    const snapshot: T[] = []

    return await withProgress<T[]>(
        async update => {
            await Promise.all(
                paths.map(async path => {
                    try {
                        const payload = { path, ...(await read(path)) } as T
                        snapshot.push(payload)
                        update(snapshot)
                        return payload
                    } catch (error: any) {
                        // silently ignore errors
                    }
                }),
            )

            return snapshot
        },
        {
            progress: prefixFormatter(options.progressPrefix, formatSnapshot),
            success: prefixFormatter(options.successPrefix, formatSnapshot),
            failure: prefixFormatter(options.failurePrefix, formatSnapshot),
        },
    )
}
