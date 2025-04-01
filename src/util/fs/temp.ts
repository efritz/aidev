import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { generateRandomName } from '../random/random'

async function withTempDir<T>(f: (dirPath: string) => Promise<T>): Promise<T> {
    const tempDir = `.aidev-${generateRandomName()}`
    await mkdir(tempDir, { recursive: true })

    try {
        return await f(tempDir)
    } finally {
        await rm(tempDir, { recursive: true, force: true })
    }
}

async function withTempFile<T>(f: (filePath: string) => Promise<T>, referencePath: string = ''): Promise<T> {
    if (referencePath === '') {
        return withTempDir(tempDir => f(path.join(tempDir, generateRandomName())))
    }

    const tempFileName = `${path.basename(referencePath)}-${Date.now()}`
    const tempFilePath = path.join(path.dirname(referencePath), tempFileName)

    try {
        return await f(tempFilePath)
    } finally {
        await rm(tempFilePath, { force: true })
    }
}

export async function withTempFileContents<T>(
    contents: string,
    f: (filePath: string) => Promise<T>,
    referencePath: string = '',
): Promise<T> {
    return withTempFile(async filePath => {
        await writeFile(filePath, contents)
        return f(filePath)
    }, referencePath)
}
