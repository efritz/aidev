import { homedir } from 'os'
import path from 'path'

export function xdgConfigHome(): string {
    return process.env['XDG_CONFIG_HOME'] || path.join(homedir(), '.config')
}

export function xdgCacheHome(): string {
    return process.env['XDG_CACHE_HOME'] || path.join(homedir(), '.cache')
}
