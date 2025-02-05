import {
    Content,
    EnhancedGenerateContentResponse,
    FunctionDeclaration,
    GoogleGenerativeAI,
} from '@google/generative-ai'
import { tools as toolDefinitions } from '../../tools/tools'
import { createProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createGoogleProviderSpec(preferences: Preferences): Promise<ProviderSpec> {
    const providerName = 'Google'
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createGoogleProvider(providerName, apiKey ?? ''),
    }
}

function createGoogleProvider(providerName: string, apiKey: string): ProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
        const client = new GoogleGenerativeAI(apiKey)
        const createStream = createStreamFactory({
            client,
            modelName: model,
            system,
            temperature,
            maxTokens,
            disableTools,
        })

        return createProvider({
            providerName,
            modelName,
            system,
            createStream,
            createStreamReducer,
            createConversation: () => createConversation(contextState),
        })
    }
}

function createStreamFactory({
    client,
    modelName,
    system,
    temperature,
    maxTokens,
    disableTools,
}: {
    client: GoogleGenerativeAI
    modelName: string
    system: string
    temperature?: number
    maxTokens?: number
    disableTools?: boolean
}): StreamFactory<EnhancedGenerateContentResponse, Content> {
    const tools = disableTools
        ? []
        : [
              {
                  functionDeclarations: toolDefinitions.map(
                      ({ name, description, parameters }): FunctionDeclaration => ({
                          name,
                          description,
                          parameters: parameters as any,
                      }),
                  ),
              },
          ]

    return async (messages, signal) => {
        const model = client.getGenerativeModel({
            model: modelName,
            systemInstruction: system,
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
            },
            tools,
        })

        const { response, stream } = await model.generateContentStream({ contents: messages }, { signal })
        response.catch(() => {}) // Prevent uncaught exception (errors are also emitted by the stream)
        return stream
    }
}
