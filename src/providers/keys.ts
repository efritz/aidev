import { homedir } from 'os'
import path from 'path'
import { safeReadFile } from '../util/fs/safe'

export async function getKey(name: string): Promise<string | undefined> {
    return (await safeReadFile(keyPath(name))).trim()
}

function keyPath(name: string): string {
    return path.join(keyDir(), `${name.toLowerCase()}.key`)
}

function keyDir(): string {
    return process.env.AIDEV_KEY_DIR || path.join(xdgConfigHome(), 'aidev', 'keys')
}

function xdgConfigHome(): string {
    return process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config')
}
