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
        name: 'o1-preview',
        model: 'o1-preview-2024-09-12',
        options: {
            supportsDeveloperMessage: false,
            supportsTools: false,
            minimumTempature: 1.0,
        },
    },
    {
        name: 'o1-mini',
        model: 'o1-mini-2024-09-12',
        options: {
            supportsDeveloperMessage: false,
            supportsTools: false,
            minimumTempature: 1.0,
        },
    },
    {
        name: 'gpt-4o',
        model: 'gpt-4o-2024-08-06',
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

async function createOpenAIProvider({
    contextState,
    model: { name, model, options },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Promise<Provider> {
    const apiKey = await getKey('openai')
    const client = new OpenAI({ apiKey })
    const { providerMessages, ...conversationManager } = createConversation(
        contextState,
        system,
        options?.supportsDeveloperMessage ?? true,
    )

    return createProvider({
        name,
        system,
        createStream: () =>
            createStream({
                client,
                model,
                messages: providerMessages(),
                temperature: Math.max(temperature, options?.minimumTempature ?? 0),
                maxTokens,
                supportsTools: options?.supportsTools ?? true,
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
    supportsTools,
}: {
    client: OpenAI
    model: string
    messages: ChatCompletionMessageParam[]
    temperature?: number
    maxTokens?: number
    supportsTools: boolean
}): Promise<Stream<ChatCompletionChunk>> {
    const iterable = await client.chat.completions.create({
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
    })

    return abortableIterator(iterable, () => iterable.controller.abort())
}
