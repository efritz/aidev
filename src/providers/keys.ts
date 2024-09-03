import { readFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

const SCRIPTS_ROOT = path.join(homedir(), 'dev', 'efritz', 'aidev')

export async function getKey(name: string): Promise<string> {
    return (await readFile(path.join(SCRIPTS_ROOT, 'keys', `${name}.key`), 'utf8')).trim()
}
