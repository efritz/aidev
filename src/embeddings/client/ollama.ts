import ollama, { Ollama } from 'ollama'
import { Preferences } from '../../providers/preferences'
import { Limiter, wrapPromise } from '../../util/ratelimits/limiter'
import { Client, ClientFactory, ClientSpec, registerModelLimits } from './client'

// Create an Ollama client with a configurable host
const ollamaClient = new Ollama({ host: process.env.OLLAMA_HOST  ||'http://localhost:11434' })

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
