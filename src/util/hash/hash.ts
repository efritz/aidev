import { createHash } from 'crypto'

export function hash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
}
