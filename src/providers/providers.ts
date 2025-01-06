import { ContextState } from '../context/state'
import { createAnthropicProviderSpec } from './anthropic/provider'
import { createDeepSeekProviderSpec } from './deepseek/provider'
import { createGoogleProviderSpec } from './google/provider'
import { createGroqProviderSpec } from './groq/provider'
import { createOllamaProviderSpec } from './ollama/provider'
import { createOpenAIProviderSpec } from './openai/provider'
import { Preferences } from './preferences'
import { Provider, ProviderSpec } from './provider'

export type Providers = {
    providerSpecs: ProviderSpec[]
    modelNames: string[]
    formattedModels: string
    createProvider(contextState: ContextState, modelName: string, system: string): Promise<Provider>
}

const providerSpecFactories = [
    createAnthropicProviderSpec,
    createGoogleProviderSpec,
    createGroqProviderSpec,
    createOllamaProviderSpec,
    createOpenAIProviderSpec,
    createDeepSeekProviderSpec,
]

export const initProviders = async (preferences: Preferences): Promise<Providers> => {
    const providerSpecs: ProviderSpec[] = []
    for (const factory of providerSpecFactories) {
        providerSpecs.push(await factory(preferences))
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
        createProvider: async (contextState: ContextState, modelName: string, system: string) =>
            createProvider(providerSpecs, contextState, modelName, system),
    }
}

function formatModels(providerSpecs: ProviderSpec[]): string {
    return providerSpecs
        .map(
            ({ providerName, needsAPIKey, models }) =>
                `- ${providerName}${needsAPIKey ? ' (no API key provided)' : ''}: ${models.map(({ name }) => name).join(', ')}`,
        )
        .sort()
        .join('\n')
}

async function createProvider(
    providerSpecs: ProviderSpec[],
    contextState: ContextState,
    modelName: string,
    system: string,
): Promise<Provider> {
    const pairs = providerSpecs.flatMap(({ factory, models }) => models.map(model => ({ factory, model })))

    const pair = pairs.find(({ model: { name } }) => name === modelName)
    if (!pair) {
        throw new Error(`Invalid model: ${modelName}`)
    }

    const { factory, model } = pair
    return factory({ contextState, model, system })
}
