import OpenAI from 'openai'
import { getKey } from '../../providers/keys'
import { Preferences } from '../../providers/preferences'
import { Client, ClientFactory, ClientSpec } from './client'

export async function createOpenAIClientSpec(preferences: Preferences): Promise<ClientSpec> {
    const providerName = 'OpenAI'
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.embeddings[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createOpenAIClient(providerName, apiKey ?? ''),
    }
}

function createOpenAIClient(providerName: string, apiKey: string): ClientFactory {
    return async ({ model: { name: modelName, model, dimensions, maxInput } }): Promise<Client> => {
        const client = new OpenAI({ apiKey })

        return {
            providerName,
            modelName,
            dimensions,
            maxInput,
            embed: async (input: string[]) =>
                (
                    await client.embeddings.create({
                        model,
                        input,
                        encoding_format: 'float',
                    })
                ).data.map(({ embedding }) => embedding),
        }
    }
}
