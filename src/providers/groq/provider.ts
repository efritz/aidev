import Groq from 'groq-sdk'
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import { ChatCompletionTool } from 'openai/resources'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createGroqProviderSpec(preferences: Preferences): Promise<ProviderSpec> {
    const providerName = 'Groq'
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createGroqProvider(providerName, apiKey ?? ''),
    }
}

function createGroqProvider(providerName: string, apiKey: string) {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
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
                    disableTools,
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
    disableTools,
}: {
    client: Groq
    model: string
    messages: ChatCompletionMessageParam[]
    temperature?: number
    maxTokens?: number
    disableTools?: boolean
}): Promise<Stream<ChatCompletionChunk>> {
    const iterable = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
        tools: disableTools
            ? []
            : toolDefinitions.map(
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
