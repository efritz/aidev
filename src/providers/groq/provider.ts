import Groq from 'groq-sdk'
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import { ChatCompletionTool } from 'openai/resources'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Groq'

const models: Model[] = [
    {
        name: 'llama3-70b',
        model: 'llama3-8b-8192',
    },
]

export const provider: ProviderSpec = {
    providerName,
    models,
    factory: createGroqProvider,
}

async function createGroqProvider({
    contextState,
    model: { name: modelName, model },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Promise<Provider> {
    const apiKey = await getKey('groq')
    const client = new Groq({ apiKey })
    const { providerMessages, ...conversationManager } = createConversation(contextState, system)

    return createProvider({
        providerName,
        modelName,
        system,
        createStream: () =>
            createStream({
                client,
                model,
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
    model,
    messages,
    temperature,
    maxTokens,
}: {
    client: Groq
    model: string
    messages: ChatCompletionMessageParam[]
    temperature?: number
    maxTokens?: number
}): Promise<Stream<ChatCompletionChunk>> {
    const iterable = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
        tools: toolDefinitions.map(
            ({ name, description, parameters }): ChatCompletionTool => ({
                type: 'function',
                function: {
                    name,
                    description,
                    parameters,
                },
            }),
        ),
    })

    return abortableIterator(iterable, () => iterable.controller.abort())
}
