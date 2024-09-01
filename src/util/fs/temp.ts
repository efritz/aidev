import { randomBytes } from 'crypto'
import { unlink, writeFile } from 'fs/promises'

export async function withTempFile<T>(content: string, f: (filename: string) => Promise<T>): Promise<T> {
    const tempPath = `/tmp/aidev-${randomBytes(16).toString('hex')}`
    await writeFile(tempPath, content)

    try {
        return await f(tempPath)
    } finally {
        try {
            await unlink(tempPath)
        } catch (error: any) {}
    }
}
