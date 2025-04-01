import { Limiter, wrapPromise } from '../../util/ratelimits/limiter'
import {
    EmbeddingsProvider,
    EmbeddingsProviderFactory,
    EmbeddingsProviderSpec,
    registerModelLimits,
} from '../embeddings_provider'
import { Preferences } from '../preferences'
import { ollamaClient } from './client'

const providerName = 'Ollama'

export const OllamaEmbeddingsProviderFactory = {
    name: providerName,
    create: createOllamaEmbeddingsProviderSpec,
}

async function createOllamaEmbeddingsProviderSpec(
    preferences: Preferences,
    limiter: Limiter,
): Promise<EmbeddingsProviderSpec> {
    const models = preferences.embeddings[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: false,
        factory: createOllamaEmbeddingsProvider(providerName, limiter),
    }
}

function createOllamaEmbeddingsProvider(providerName: string, limiter: Limiter): EmbeddingsProviderFactory {
    return async ({ model: { name: modelName, model, dimensions, maxInput } }): Promise<EmbeddingsProvider> => {
        return {
            providerName,
            modelName,
            dimensions,
            maxInput,
            embed: wrapPromise(
                limiter,
                modelName,
                async (input: string[]) =>
                    (
                        await ollamaClient.embed({
                            model,
                            input,
                        })
                    ).embeddings,
            ),
        }
    }
}
