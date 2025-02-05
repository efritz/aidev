import { lstat, readFile } from 'fs/promises'
import { isBinaryFile } from 'isbinaryfile'

export async function exists(path: string): Promise<boolean> {
    try {
        await lstat(path)
        return true
    } catch (_error: any) {
        return false
    }
}

export async function isDir(path: string): Promise<boolean> {
    try {
        return (await lstat(path)).isDirectory()
    } catch (_error: any) {
        return false
    }
}

const maxSize = 1_000_000 // 1MB

export async function safeReadFile(path: string): Promise<string> {
    try {
        if ((await lstat(path)).size <= maxSize) {
            const content = await readFile(path, 'utf-8')

            if (!(await isBinaryFile(Buffer.from(content)))) {
                return content
            }
        }
    } catch (_error: any) {
        // swallow
    }

    return ''
}
