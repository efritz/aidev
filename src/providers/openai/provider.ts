import { OpenAI } from 'openai'
import { ChatCompletionChunk, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'gpt-4o',
        model: 'gpt-4o-2024-08-06',
    },
    {
        name: 'gpt-4o-latest',
        model: 'chatgpt-4o-latest',
    },
    {
        name: 'gpt-4',
        model: 'gpt-4',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createOpenAIProvider,
}

function createOpenAIProvider({
    model: { model },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Provider {
    const apiKey = getKey('openai')
    const client = new OpenAI({ apiKey })
    const { providerMessages, ...conversationManager } = createConversation(system)

    return createProvider({
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
    client: OpenAI
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
