import { provider as anthropicProvider } from './anthropic/provider'
import { provider as googleProvider } from './google/provider'
import { provider as groqProvider } from './groq/provider'
import { provider as ollamaProvider } from './ollama/provider'
import { provider as openAIProvider } from './openai/provider'
import { Provider, ProviderSpec } from './provider'

const providers: ProviderSpec[] = [anthropicProvider, openAIProvider, googleProvider, groqProvider, ollamaProvider]
export const modelNames = providers.flatMap(({ models }) => models.map(({ name }) => name)).sort()

export function createProvider(modelName: string, system: string): Provider {
    const pairs = providers.flatMap(({ factory, models }) => models.map(model => ({ factory, model })))

    const pair = pairs.find(({ model: { name } }) => name === modelName)
    if (!pair) {
        throw new Error(`Invalid model: ${modelName}`)
    }

    const { factory, model } = pair
    return factory({ model, system })
}
