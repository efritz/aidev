import ollama from 'ollama'
import { Preferences } from '../../providers/preferences'
import { Client, ClientFactory, ClientSpec } from './client'

export async function createOllamaClientSpec(preferences: Preferences): Promise<ClientSpec> {
    const providerName = 'Ollama'

    return {
        providerName,
        models: preferences.embeddings[providerName] ?? [],
        needsAPIKey: false,
        factory: createOllamaClient(providerName),
    }
}

function createOllamaClient(providerName: string): ClientFactory {
    return async ({ model: { name: modelName, model, dimensions, maxInput } }): Promise<Client> => {
        return {
            providerName,
            modelName,
            dimensions,
            maxInput,
            embed: async (input: string[]) => (await ollama.embed({ model, input })).embeddings,
        }
    }
}
