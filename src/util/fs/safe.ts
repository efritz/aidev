import { lstat, readFile } from 'fs/promises'

export async function isDir(path: string): Promise<boolean> {
    try {
        return (await lstat(path)).isDirectory()
    } catch (error: any) {
        return false
    }
}

export async function safeReadFile(path: string): Promise<string> {
    try {
        return await readFile(path, 'utf-8')
    } catch (error: any) {
        return ''
    }
}
