import { homedir } from 'os'
import path from 'path'

export function xdgConfigHome(): string {
    return process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config')
}
