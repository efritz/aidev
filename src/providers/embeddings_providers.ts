import { Limiter } from '../util/ratelimits/limiter'
import { UsageTracker } from '../util/usage/tracker'
import { EmbeddingsProvider, EmbeddingsProviderSpec } from './embeddings_provider'
import { OllamaEmbeddingsProviderFactory } from './ollama/embeddings'
import { OpenAIEmbeddingsProviderFactory } from './openai/embeddings'
import { Preferences } from './preferences'

export type EmbeddingsProviders = {
    clientSpecs: EmbeddingsProviderSpec[]
    modelNames: string[]
    createProvider(modelName: string): Promise<EmbeddingsProvider>
}

export type EmbeddingsProviderSpecFactory = {
    name: string
    create: (preferences: Preferences, limiter: Limiter, tracker: UsageTracker) => Promise<EmbeddingsProviderSpec>
}

export const embeddingsProviderSpecFactories: EmbeddingsProviderSpecFactory[] = [
    OpenAIEmbeddingsProviderFactory,
    OllamaEmbeddingsProviderFactory,
]

export const initEmbeddingsProviders = async (
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<EmbeddingsProviders> => {
    const clientSpecs: EmbeddingsProviderSpec[] = []
    for (const factory of embeddingsProviderSpecFactories) {
        clientSpecs.push(await factory.create(preferences, limiter, tracker))
    }

    const allModelNames = clientSpecs.flatMap(({ models }) => models.map(({ name }) => name)).sort()
    if (new Set(allModelNames).size !== allModelNames.length) {
        throw new Error('Model names are not unique across clients')
    }

    const availableModelNames = clientSpecs
        .filter(({ needsAPIKey }) => !needsAPIKey)
        .flatMap(({ models }) => models.map(({ name }) => name))
        .sort()

    return {
        clientSpecs,
        modelNames: availableModelNames,
        createProvider: async (modelName: string) => createEmbeddingsProvider(clientSpecs, modelName),
    }
}

async function createEmbeddingsProvider(
    clientSpecs: EmbeddingsProviderSpec[],
    modelName: string,
): Promise<EmbeddingsProvider> {
    const pairs = clientSpecs.flatMap(({ models, factory }) => models.map(model => ({ factory, model })))

    const pair = pairs.find(({ model: { name } }) => name === modelName)
    if (!pair) {
        throw new Error(`No client found for model ${modelName}`)
    }

    const { factory, model } = pair
    return factory({ model })
}
