import { readFile } from 'fs/promises'
import path from 'path'
import { parse } from 'yaml'
import { xdgConfigHome } from '../util/fs/xdgconfig'
import { Model } from './provider'

export type Preferences = {
    defaultModel: string
    reprompterModel: string
    providers: {
        [key: string]: Model[]
    }
}

export async function getPreferences(): Promise<Preferences> {
    return parse(await readFile(preferencesPath(), 'utf-8'))
}

function preferencesPath(): string {
    return path.join(preferencesDir(), 'preferences.yaml')
}

function preferencesDir(): string {
    return process.env.AIDEV_PREFERENCES_DIR || path.join(xdgConfigHome(), 'aidev')
}
