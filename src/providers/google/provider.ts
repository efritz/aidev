import {
    Content,
    EnhancedGenerateContentResponse,
    FunctionDeclaration,
    GoogleGenerativeAI,
} from '@google/generative-ai'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'gemini',
        model: 'gemini-1.5-flash',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createGoogleProvider,
}

function createGoogleProvider({
    model: { model: modelName },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Provider {
    const apiKey = getKey('google')
    const client = new GoogleGenerativeAI(apiKey)
    const { providerMessages, ...conversationManager } = createConversation()

    return createProvider({
        createStream: () =>
            createStream({
                client,
                modelName,
                system,
                messages: providerMessages(),
                temperature,
                maxTokens,
            }),
        createStreamReducer,
        conversationManager,
    })
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
