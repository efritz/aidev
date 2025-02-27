import path from 'path'
import chalk from 'chalk'
import { Model as EmbeddingModel } from '../embeddings/client/client'
import { exists } from '../util/fs/safe'
import { xdgConfigHome } from '../util/fs/xdgconfig'
import { loadYamlFromFile } from '../util/yaml/load'
import { Model } from './provider'

export type Preferences = {
    defaultModel: string
    reprompterModel: string
    embeddingsModel: string
    summarizerModel: string
    webTranslatorModel: string
    providers: {
        [key: string]: Model[]
    }
    embeddings: {
        [key: string]: EmbeddingModel[]
    }
}

const repoRoot = path.join(__dirname, '..', '..')
const defaultPreferencesPath = path.join(repoRoot, 'configs', 'preferences.default.yaml')

export async function getPreferences(): Promise<Preferences> {
    return loadYamlFromFile(await preferencesPath())
}

async function preferencesPath(): Promise<string> {
    const userPreferencesPath = path.join(preferencesDir(), 'preferences.yaml')
    if (await exists(userPreferencesPath)) {
        return userPreferencesPath
    }

    console.log(chalk.red('Falling back to default preferences'))
    return defaultPreferencesPath
}

function preferencesDir(): string {
    return process.env['AIDEV_PREFERENCES_DIR'] || configDir()
}

function configDir(): string {
    return path.join(xdgConfigHome(), 'aidev')
}
