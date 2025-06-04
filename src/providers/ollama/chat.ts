import { ChatResponse, Message, Tool } from 'ollama'
import { toJsonSchema } from '../../tools/tool'
import { enabledTools } from '../../tools/tools'
import { abortableIterable, toIterable } from '../../util/iterable/iterable'
import { Limiter, wrapAsyncIterable } from '../../util/ratelimits/limiter'
import {
    ChatProvider,
    ChatProviderFactory,
    ChatProviderOptions,
    ChatProviderSpec,
    registerModelLimits,
} from '../chat_provider'
import { createChatProvider, StreamFactory } from '../factory'
import { Preferences } from '../preferences'
import { ollamaClient } from './client'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Ollama'

export const OllamaChatProviderFactory = {
    name: providerName,
    create: createOllamaChatProviderSpec,
}

async function createOllamaChatProviderSpec(preferences: Preferences, limiter: Limiter): Promise<ChatProviderSpec> {
    const models = preferences.providers[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: false,
        factory: createOllamaChatProvider(providerName, limiter),
    }
}

function createOllamaChatProvider(providerName: string, limiter: Limiter): ChatProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ChatProviderOptions): Promise<ChatProvider> => {
        const createStream = createStreamFactory({
            limiter,
            model,
            temperature,
            maxTokens,
            disableTools,
        })

        return createChatProvider({
            providerName,
            modelName,
            system,
            createStream,
            createStreamReducer,
            createConversation: () => createConversation(contextState, system),
        })
    }
}

function createStreamFactory({
    limiter,
    model,
    temperature,
    maxTokens,
    disableTools,
}: {
    limiter: Limiter
    model: string
    temperature?: number
    maxTokens?: number
    disableTools?: boolean
}): StreamFactory<ChatResponse, Message> {
    const tools = disableTools
        ? []
        : enabledTools.map(
              ({ name, description, schema }): Tool => ({
                  type: '',
                  function: {
                      name,
                      description,
                      parameters: toJsonSchema(schema),
                  },
              }),
          )

    return wrapAsyncIterable(limiter, model, async (messages: Message[], signal?: AbortSignal) => {
        // https://github.com/ollama/ollama-js/issues/123
        const iterable = toIterable(() =>
            ollamaClient.chat({
                model,
                messages,
                options: {
                    temperature,
                    num_predict: maxTokens,
                },
                tools,
            }),
        )

        return abortableIterable(iterable, signal)
    })
}
