import { Preferences } from '../../providers/preferences'
import { Client, ClientSpec } from './client'
import { createOllamaClientSpec } from './ollama'
import { createOpenAIClientSpec } from './openai'

export type EmbeddingsClients = {
    clientSpecs: ClientSpec[]
    modelNames: string[]
    createClient(modelName: string): Promise<Client>
}

const clientSpecFactories = [createOpenAIClientSpec, createOllamaClientSpec]

export const initClients = async (preferences: Preferences): Promise<EmbeddingsClients> => {
    const clientSpecs: ClientSpec[] = []
    for (const factory of clientSpecFactories) {
        clientSpecs.push(await factory(preferences))
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
