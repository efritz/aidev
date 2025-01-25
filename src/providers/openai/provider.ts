import { OpenAI } from 'openai'
import { ChatCompletionChunk, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources'
import { tools as toolDefinitions } from '../../tools/tools'
import { toIterable } from '../../util/iterable/iterable'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer, toChunk } from './reducer'

export async function createOpenAIProviderSpec(preferences: Preferences): Promise<ProviderSpec> {
    const providerName = 'OpenAI'
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createOpenAIProvider(providerName, apiKey ?? ''),
    }
}

function createOpenAIProvider(providerName: string, apiKey: string): ProviderFactory {
    return createOpenAICompatibleProvider(providerName, apiKey)
}

export function createOpenAICompatibleProvider(
    providerName: string,
    apiKey: string,
    baseURL?: string,
): ProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model, options },
        system,
        temperature = 0.0,
        maxTokens = 4096,
    }: ProviderOptions): Promise<Provider> => {
        const client = new OpenAI({ apiKey, baseURL })
        const { providerMessages, ...conversationManager } = createConversation(
            contextState,
            system,
            options?.systemMessageRole ?? 'developer',
        )

        return createProvider({
            providerName,
            modelName,
            system,
            createStream: () =>
                createStream({
                    client,
                    model,
                    messages: providerMessages(),
                    temperature: Math.max(temperature, options?.minimumTempature ?? 0),
                    maxTokens,
                    supportsTools: options?.supportsTools ?? true,
                    supportsStreaming: options?.supportsStreaming ?? true,
                }),
            createStreamReducer,
            conversationManager,
        })
    }
}

async function createStream({
    client,
    model,
    messages,
    temperature,
    maxTokens,
    supportsTools,
    supportsStreaming,
}: {
    client: OpenAI
    model: string
    messages: ChatCompletionMessageParam[]
    temperature?: number
    maxTokens?: number
    supportsTools: boolean
    supportsStreaming: boolean
}): Promise<Stream<ChatCompletionChunk>> {
    const options = {
        model,
        messages,
        stream: true,
        temperature,
        max_completion_tokens: maxTokens,
        tools: supportsTools
            ? toolDefinitions.map(
                  ({ name, description, parameters }): ChatCompletionTool => ({
                      type: 'function',
                      function: {
                          name,
                          description,
                          parameters,
                      },
                  }),
              )
            : undefined,
    }

    if (!supportsStreaming) {
        const iterable = toIterable(async () =>
            toChunk(await client.chat.completions.create({ ...options, stream: false })),
        )
        return abortableIterator(iterable, () => {})
    }

    const iterable = await client.chat.completions.create({ ...options, stream: true })
    return abortableIterator(iterable, () => iterable.controller.abort())
}
