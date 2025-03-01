import { Limiter } from '../util/ratelimits/limiter'
import { UsageTracker } from '../util/usage/tracker'
import { AnthropicChatProviderFactory } from './anthropic/provider'
import { DeepSeekChatProviderFactory } from './deepseek/provider'
import { GoogleChatProviderFactory } from './google/provider'
import { GroqChatProviderFactory } from './groq/provider'
import { OllamaChatProviderFactory } from './ollama/provider'
import { OpenAIChatProviderFactory } from './openai/provider'
import { Preferences } from './preferences'
import { ChatProviderOptions as BaseProviderOptions, ChatProvider, ChatProviderSpec } from './provider'

export type ChatProviders = {
    providerSpecs: ChatProviderSpec[]
    modelNames: string[]
    formattedModels: string
    createProvider(opts: ChatProviderOptions): Promise<ChatProvider>
}

export type ChatProviderOptions = Omit<BaseProviderOptions, 'model'> & {
    modelName: string
}

export type ChatProviderSpecFactory = {
    name: string
    create: (preferences: Preferences, limiter: Limiter, tracker: UsageTracker) => Promise<ChatProviderSpec>
}

export const chatProviderSpecFactories: ChatProviderSpecFactory[] = [
    AnthropicChatProviderFactory,
    GoogleChatProviderFactory,
    GroqChatProviderFactory,
    OllamaChatProviderFactory,
    OpenAIChatProviderFactory,
    DeepSeekChatProviderFactory,
]

export const initChatProviders = async (
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<ChatProviders> => {
    const providerSpecs: ChatProviderSpec[] = []
    for (const factory of chatProviderSpecFactories) {
        providerSpecs.push(await factory.create(preferences, limiter, tracker))
    }

    const allModelNames = providerSpecs.flatMap(({ models }) => models.map(({ name }) => name)).sort()
    if (new Set(allModelNames).size !== allModelNames.length) {
        throw new Error('Model names are not unique across providers')
    }

    const availableModelNames = providerSpecs
        .filter(({ needsAPIKey }) => !needsAPIKey)
        .flatMap(({ models }) => models.map(({ name }) => name))
        .sort()

    return {
        providerSpecs,
        modelNames: availableModelNames,
        formattedModels: formatModels(providerSpecs),
        createProvider: async opts => createChatProvider(opts, providerSpecs),
    }
}

function formatModels(providerSpecs: ChatProviderSpec[]): string {
    return providerSpecs
        .map(
            ({ providerName, needsAPIKey, models }) =>
                `- ${providerName}${needsAPIKey ? ' (no API key provided)' : ''}: ${models.map(({ name }) => name).join(', ')}`,
        )
        .sort()
        .join('\n')
}

async function createChatProvider(
    { modelName, ...opts }: ChatProviderOptions,
    providerSpecs: ChatProviderSpec[],
): Promise<ChatProvider> {
    const pairs = providerSpecs.flatMap(({ factory, models }) => models.map(model => ({ factory, model })))

    const pair = pairs.find(({ model: { name } }) => name === modelName)
    if (!pair) {
        throw new Error(`Invalid model: ${modelName}`)
    }

    const { factory, model } = pair
    return factory({ model, ...opts })
}
