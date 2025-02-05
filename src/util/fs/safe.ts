import { lstat, readFile } from 'fs/promises'
import { isBinaryFile } from 'isbinaryfile'

export async function exists(path: string): Promise<boolean> {
    try {
        const _ = await lstat(path)
        return true
    } catch (error: any) {
        return false
    }
}

export async function isDir(path: string): Promise<boolean> {
    try {
        return (await lstat(path)).isDirectory()
    } catch (error: any) {
        return false
    }
}

export async function safeReadFile(path: string): Promise<string> {
    try {
        const content = await readFile(path, 'utf-8')

        if (!(await isBinaryFile(Buffer.from(content)))) {
            return content
        }
    } catch (error: any) {
        // swallow
    }

    return ''
}
