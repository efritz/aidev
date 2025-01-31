import { Anthropic } from '@anthropic-ai/sdk'
import { MessageParam, MessageStreamEvent, Tool } from '@anthropic-ai/sdk/resources/messages'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createAnthropicProviderSpec(preferences: Preferences): Promise<ProviderSpec> {
    const providerName = 'Anthropic'
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createAnthropicProvider(providerName, apiKey ?? ''),
    }
}

function createAnthropicProvider(providerName: string, apiKey: string): ProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model, options },
        system,
        temperature = 0.0,
        maxTokens = options?.maxTokens || 4096,
    }: ProviderOptions): Promise<Provider> => {
        const defaultHeaders = options?.headers
        const client = new Anthropic({ apiKey: apiKey, defaultHeaders })
        const { providerMessages, ...conversationManager } = createConversation(contextState)

        return createProvider({
            providerName,
            modelName,
            system,
            createStream: () =>
                createStream({
                    client,
                    model,
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
