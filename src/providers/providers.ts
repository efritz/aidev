import { ContextState } from '../context/state'
import { provider as anthropicProvider } from './anthropic/provider'
import { provider as googleProvider } from './google/provider'
import { provider as groqProvider } from './groq/provider'
import { provider as ollamaProvider } from './ollama/provider'
import { provider as openAIProvider } from './openai/provider'
import { Provider, ProviderSpec, Model } from './provider'

const providers: ProviderSpec[] = [anthropicProvider, openAIProvider, googleProvider, groqProvider, ollamaProvider]

export const providerModels = providers.reduce((acc, provider) => {
    acc[provider.name] = provider.models
    return acc
}, {} as Record<string, Model[]>)

export const modelNames = Object.values(providerModels).flat().map(model => model.name).sort()

export const formattedModels = Object.entries(providerModels)
            .map(([name, models]) => {
                const modelNames = models.map(model => model.name).join(', ')
                return `- ${name}: ${modelNames}`
            })
            .join('\n')

export function createProvider(contextState: ContextState, modelName: string, system: string): Promise<Provider> {
    const pairs = providers.flatMap(({ factory, models }) => models.map(model => ({ factory, model })))

    const pair = pairs.find(({ model: { name } }) => name === modelName)
    if (!pair) {
        throw new Error(`Invalid model: ${modelName}`)
    }

    const { factory, model } = pair
    return factory({ contextState, model, system })
}
