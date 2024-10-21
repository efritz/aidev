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

export async function withTempFile<T>(originalFilePath: string, f: (filePath: string) => Promise<T>): Promise<T> {
    const tempFileName = `${path.basename(originalFilePath)}-${Date.now()}`
    const tempFilePath = path.join(path.dirname(originalFilePath), tempFileName)
    return f(tempFilePath)
}

export async function withTempFileContents<T>(originalFilePath: string, contents: string, f: (filePath: string) => Promise<T>): Promise<T> {
    return withTempFile(originalFilePath, async filePath => {
        await writeFile(filePath, contents)
        return await f(filePath)
    })
}
