import {
    Content,
    EnhancedGenerateContentResponse,
    FunctionDeclaration,
    GoogleGenerativeAI,
} from '@google/generative-ai'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
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
        const { providerMessages, ...conversationManager } = createConversation(contextState)

        return createProvider({
            providerName,
            modelName,
            system,
            createStream: () =>
                createStream({
                    client,
                    modelName: model,
                    system,
                    messages: providerMessages(),
                    temperature,
                    maxTokens,
                    disableTools,
                }),
            createStreamReducer,
            conversationManager,
        })
    }
}

async function createStream({
    client,
    modelName,
    system,
    messages,
    temperature,
    maxTokens,
    disableTools,
}: {
    client: GoogleGenerativeAI
    modelName: string
    system: string
    messages: Content[]
    temperature?: number
    maxTokens?: number
    disableTools?: boolean
}): Promise<Stream<EnhancedGenerateContentResponse>> {
    const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: system,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
        },
        tools: disableTools
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
              ],
    })

    const controller = new AbortController()
    const { response, stream } = await model.generateContentStream(
        { contents: messages },
        { signal: controller.signal },
    )

    // Catch errors also emitted by the stream
    response.catch(() => {})

    return abortableIterator(stream, () => controller.abort())
}
