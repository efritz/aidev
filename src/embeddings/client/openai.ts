import OpenAI from 'openai'
import { getKey } from '../../providers/keys'
import { Preferences } from '../../providers/preferences'
import { Limiter, wrapPromise } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { Client, ClientFactory, ClientSpec, registerModelLimits } from './client'

export async function createOpenAIClientSpec(
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<ClientSpec> {
    const providerName = 'OpenAI'
    const apiKey = await getKey(providerName)
    const models = preferences.embeddings[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: !apiKey,
        factory: createOpenAIClient(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createOpenAIClient(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ClientFactory {
    return async ({ model: { name: modelName, model, dimensions, maxInput } }): Promise<Client> => {
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
