import { readFileSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

const SCRIPTS_ROOT = path.join(homedir(), '.dotfiles', 'ai', 'scripts')

export function getKey(name: string) {
    return readFileSync(path.join(SCRIPTS_ROOT, 'keys', `${name}.key`), 'utf8').trim()
}
