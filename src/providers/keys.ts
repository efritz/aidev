import { readFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

export async function getKey(name: string): Promise<string> {
    return (await readFile(keyPath(name), 'utf8')).trim()
}

function keyPath(name: string): string {
    return path.join(keyDir(), `${name}.key`)
}

function keyDir(): string {
    return process.env.AIDEV_KEY_DIR || path.join(xdgConfigHome(), 'aidev', 'keys')
}

function xdgConfigHome(): string {
    return process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config')
}
