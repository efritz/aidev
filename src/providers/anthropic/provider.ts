import { Anthropic } from '@anthropic-ai/sdk'
import { MessageParam, MessageStreamEvent, Tool } from '@anthropic-ai/sdk/resources/messages'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'haiku',
        model: 'claude-3-haiku-20240307',
    },
    {
        name: 'sonnet',
        model: 'claude-3-5-sonnet-20240620',
        options: {
            maxTokens: 8192,
            headers: { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' },
        },
    },
    {
        name: 'opus',
        model: 'claude-3-opus-20240229',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createAnthropicProvider,
}

function createAnthropicProvider({
    model: { model, options: modelOptions },
    system,
    temperature = 0.0,
    maxTokens = modelOptions?.maxTokens || 4096,
}: ProviderOptions): Provider {
    const apiKey = getKey('anthropic')
    const defaultHeaders = modelOptions?.headers
    const client = new Anthropic({ apiKey: apiKey, defaultHeaders })
    const { providerMessages, ...conversationManager } = createConversation()

    return createProvider({
        createStream: () =>
            createStream({
                client,
                system,
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
    system,
    messages,
    temperature,
    maxTokens,
}: {
    client: Anthropic
    model: string
    system: string
    messages: MessageParam[]
    temperature?: number
    maxTokens: number
}): Promise<Stream<MessageStreamEvent>> {
    const iterable = client.messages.stream({
        model,
        system,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
        tools: toolDefinitions.map(
            ({ name, description, parameters }): Tool => ({
                name,
                description,
                input_schema: parameters,
            }),
        ),
    })

    return abortableIterator(iterable, () => iterable.controller.abort())
}
