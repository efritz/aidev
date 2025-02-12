import {
    Content,
    EnhancedGenerateContentResponse,
    FunctionDeclaration,
    GoogleGenerativeAI,
} from '@google/generative-ai'
import { tools as toolDefinitions } from '../../tools/tools'
import { Limiter, wrapAsyncIterable } from '../../util/ratelimits/limiter'
import { createProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec, registerModelLimits } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createGoogleProviderSpec(preferences: Preferences, limiter: Limiter): Promise<ProviderSpec> {
    const providerName = 'Google'
    const apiKey = await getKey(providerName)
    const models = preferences.providers[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: !apiKey,
        factory: createGoogleProvider(providerName, apiKey ?? '', limiter),
    }
}

function createGoogleProvider(providerName: string, apiKey: string, limiter: Limiter): ProviderFactory {
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
            limiter,
            model,
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
    limiter,
    model,
    system,
    temperature,
    maxTokens,
    disableTools,
}: {
    client: GoogleGenerativeAI
    limiter: Limiter
    model: string
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

    return wrapAsyncIterable(limiter, model, async (messages: Content[], signal?: AbortSignal) => {
        const m = client.getGenerativeModel({
            model,
            systemInstruction: system,
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
            },
            tools,
        })

        const { response, stream } = await m.generateContentStream({ contents: messages }, { signal })
        response.catch(() => {}) // Prevent uncaught exceptions during streaming
        return stream
    })
}
