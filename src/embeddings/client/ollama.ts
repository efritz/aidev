import ollama from 'ollama'
import { Preferences } from '../../providers/preferences'
import { Limiter } from '../../util/ratelimits/limiter'
import { Client, ClientFactory, ClientSpec, registerModelLimits } from './client'

export async function createOllamaClientSpec(preferences: Preferences, limiter: Limiter): Promise<ClientSpec> {
    const providerName = 'Ollama'

    const models = preferences.embeddings[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: false,
        factory: createOllamaClient(providerName, limiter),
    }
}

function createOllamaClient(providerName: string, limiter: Limiter): ClientFactory {
    return async ({ model: { name: modelName, model, dimensions, maxInput } }): Promise<Client> => {
        return {
            providerName,
            modelName,
            dimensions,
            maxInput,
            embed: limiter.wrap(
                modelName,
                async (input: string[]) => (await ollama.embed({ model, input })).embeddings,
            ),
        }
    }
}
