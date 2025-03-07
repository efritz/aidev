import path from 'path'
import chalk from 'chalk'
import { z } from 'zod'
import { exists } from '../util/fs/safe'
import { xdgConfigHome } from '../util/fs/xdgconfig'
import { loadYamlFromFile } from '../util/yaml/load'
import { chatProviderSpecFactories } from './chat_providers'
import { embeddingsProviderSpecFactories } from './embeddings_providers'

const ChatModelSchema = z.object({
    name: z.string(),
    model: z.string(),
    options: z
        .object({
            // Anthropic only
            maxTokens: z.number().optional(),
            headers: z.record(z.string(), z.string()).optional(),

            // OpenAI only
            supportsTools: z.boolean().optional(),
            supportsStreaming: z.boolean().optional(),
            minimumTempature: z.number().optional(),
            systemMessageRole: z.enum(['developer', 'system', 'user']).optional(),
        })
        .optional(),
    maxPerSecond: z.number().optional(),
    maxConcurrent: z.number().optional(),
})

const EmbeddingModelSchema = z.object({
    name: z.string(),
    model: z.string(),
    dimensions: z.number(),
    maxInput: z.number(),
    maxPerSecond: z.number().optional(),
    maxConcurrent: z.number().optional(),
})

const PreferencesSchema = z.object({
    defaultModel: z.string(),
    reprompterModel: z.string(),
    embeddingsModel: z.string(),
    summarizerModel: z.string(),
    webTranslatorModel: z.string(),
    providers: z.record(
        z.enum(chatProviderSpecFactories.map(f => f.name) as [string, ...string[]]),
        z.array(ChatModelSchema),
    ),
    embeddings: z.record(
        z.enum(embeddingsProviderSpecFactories.map(f => f.name) as [string, ...string[]]),
        z.array(EmbeddingModelSchema),
    ),
    shellCommand: z.string(),
});

export type ChatModel = z.infer<typeof ChatModelSchema>
export type EmbeddingsModel = z.infer<typeof EmbeddingModelSchema>
export type Preferences = z.infer<typeof PreferencesSchema>

const repoRoot = path.join(__dirname, '..', '..')
const defaultPreferencesPath = path.join(repoRoot, 'configs', 'preferences.default.yaml')

export async function getPreferences(): Promise<Preferences> {
    return PreferencesSchema.parse(await loadYamlFromFile(await preferencesPath()))
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
