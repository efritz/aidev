import { ChatResponse, Message, Ollama, Tool } from 'ollama'
import { enabledTools } from '../../tools/tools'
import { abortableIterable, toIterable } from '../../util/iterable/iterable'
import { Limiter, wrapAsyncIterable } from '../../util/ratelimits/limiter'
import { createProvider, StreamFactory } from '../factory'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec, registerModelLimits } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Ollama'

export const OllamaProviderFactory = {
    name: providerName,
    create: createOllamaProviderSpec,
}

// Create an Ollama client with a configurable host
const ollamaClient = new Ollama({ host: process.env['OLLAMA_HOST'] || 'http://localhost:11434' })

export async function createOllamaProviderSpec(preferences: Preferences, limiter: Limiter): Promise<ProviderSpec> {
    const models = preferences.providers[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: false,
        factory: createOllamaProvider(providerName, limiter),
    }
}

function createOllamaProvider(providerName: string, limiter: Limiter): ProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
        const createStream = createStreamFactory({
            limiter,
            model,
            temperature,
            maxTokens,
            disableTools,
        })

        return createProvider({
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
              ({ name, description, parameters }): Tool => ({
                  type: '',
                  function: {
                      name,
                      description,
                      parameters,
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
