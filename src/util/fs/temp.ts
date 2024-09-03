import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { generateRandomName } from '../random/random'

export async function withTempDir<T>(f: (dirPath: string) => Promise<T>): Promise<T> {
    const tempDir = `.aidev-${generateRandomName()}`
    await mkdir(tempDir, { recursive: true })

    try {
        return await f(tempDir)
    } finally {
        await rm(tempDir, { recursive: true, force: true })
    }
}

export async function withTempFile<T>(f: (filePath: string) => Promise<T>): Promise<T> {
    return withTempDir(tempDir => f(path.join(tempDir, generateRandomName())))
}

export async function withTempFileContents<T>(contents: string, f: (filePath: string) => Promise<T>): Promise<T> {
    return withTempFile(async filePath => {
        await writeFile(filePath, contents)
        return await f(filePath)
    })
}
