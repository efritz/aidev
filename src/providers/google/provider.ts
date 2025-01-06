import {
    Content,
    EnhancedGenerateContentResponse,
    FunctionDeclaration,
    GoogleGenerativeAI,
} from '@google/generative-ai'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Model, Provider, ProviderFactory, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createGoogleProviderSpec(): Promise<ProviderSpec> {
    const providerName = 'Google'
    const apiKey = await getKey(providerName)

    const models: Model[] = [
        {
            name: 'gemini',
            model: 'gemini-2.0-flash-exp',
        },
    ]

    return {
        providerName,
        models,
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
}: {
    client: GoogleGenerativeAI
    modelName: string
    system: string
    messages: Content[]
    temperature?: number
    maxTokens?: number
}): Promise<Stream<EnhancedGenerateContentResponse>> {
    const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: system,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
        },
        tools: [
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
