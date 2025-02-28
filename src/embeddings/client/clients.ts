import { Preferences } from '../../providers/preferences'
import { Limiter } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { Client, ClientSpec } from './client'
import { OllamaClientFactory } from './ollama'
import { OpenAIClientFactory } from './openai'

export type EmbeddingsClients = {
    clientSpecs: ClientSpec[]
    modelNames: string[]
    createClient(modelName: string): Promise<Client>
}

export type ClientSpecFactory = {
    name: string
    create: (preferences: Preferences, limiter: Limiter, tracker: UsageTracker) => Promise<ClientSpec>
}

export const clientSpecFactories: ClientSpecFactory[] = [OpenAIClientFactory, OllamaClientFactory]

export const initClients = async (
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<EmbeddingsClients> => {
    const clientSpecs: ClientSpec[] = []
    for (const factory of clientSpecFactories) {
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
        createClient: async (modelName: string) => createClient(clientSpecs, modelName),
    }
}

async function createClient(clientSpecs: ClientSpec[], modelName: string): Promise<Client> {
    const pairs = clientSpecs.flatMap(({ models, factory }) => models.map(model => ({ factory, model })))

    const pair = pairs.find(({ model: { name } }) => name === modelName)
    if (!pair) {
        throw new Error(`No client found for model ${modelName}`)
    }

    const { factory, model } = pair
    return factory({ model })
}
