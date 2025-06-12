import path from 'path'
import { safeReadFile } from '../util/fs/safe'
import { xdgConfigHome } from '../util/fs/xdgconfig'

export async function getKey(name: string): Promise<string | undefined> {
    return (await safeReadFile(keyPath(name))).trim()
}

function keyPath(name: string): string {
    return path.join(keyDir(), `${name.toLowerCase()}.key`)
}

export function keyDir(): string {
    return process.env['AIDEV_KEY_DIR'] || path.join(configDir(), 'keys')
}

function configDir(): string {
    return path.join(xdgConfigHome(), 'aidev')
}
