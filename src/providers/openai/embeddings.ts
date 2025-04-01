import OpenAI from 'openai'
import { Limiter, wrapPromise } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import {
    EmbeddingsProvider,
    EmbeddingsProviderFactory,
    EmbeddingsProviderSpec,
    registerModelLimits,
} from '../embeddings_provider'
import { getKey } from '../keys'
import { Preferences } from '../preferences'

const providerName = 'OpenAI'

export const OpenAIEmbeddingsProviderFactory = {
    name: providerName,
    create: createOpenAIEmbeddingsProviderSpec,
}

async function createOpenAIEmbeddingsProviderSpec(
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<EmbeddingsProviderSpec> {
    const apiKey = await getKey(providerName)
    const models = preferences.embeddings[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: !apiKey,
        factory: createOpenAIEmbeddingsProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createOpenAIEmbeddingsProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): EmbeddingsProviderFactory {
    return async ({ model: { name: modelName, model, dimensions, maxInput } }): Promise<EmbeddingsProvider> => {
        const client = new OpenAI({ apiKey })
        const modelTracker = tracker.trackerFor(modelName)

        return {
            providerName,
            modelName,
            dimensions,
            maxInput,
            embed: wrapPromise(limiter, modelName, async (input: string[], signal?: AbortSignal) => {
                const resp = await client.embeddings.create(
                    {
                        model,
                        input,
                        encoding_format: 'float',
                    },
                    { signal },
                )

                modelTracker.add({ inputTokens: resp.usage.prompt_tokens })
                return resp.data.map(({ embedding }) => embedding)
            }),
        }
    }
}
