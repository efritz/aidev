import { randomBytes } from 'crypto'

export function generateRandomName(length: number = 16): string {
    return randomBytes(length).toString('hex')
}
