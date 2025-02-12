import ollama, { ChatResponse, Message, Tool } from 'ollama'
import pDefer from 'p-defer'
import { tools as toolDefinitions } from '../../tools/tools'
import { CancelError } from '../../util/interrupts/interrupts'
import { toIterable } from '../../util/iterable/iterable'
import { Limiter } from '../../util/ratelimits/limiter'
import { createProvider, Stream, StreamFactory } from '../factory'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec, registerModelLimits } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createOllamaProviderSpec(preferences: Preferences, limiter: Limiter): Promise<ProviderSpec> {
    const providerName = 'Ollama'
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
        : toolDefinitions.map(
              ({ name, description, parameters }): Tool => ({
                  type: '',
                  function: {
                      name,
                      description,
                      parameters,
                  },
              }),
          )

    return limiter.wrap(model, onDone => async (messages: Message[], signal?: AbortSignal) => {
        // https://github.com/ollama/ollama-js/issues/123
        const iterable = toIterable(async () =>
            ollama.chat({
                model,
                messages,
                options: {
                    temperature,
                    num_predict: maxTokens,
                },
                tools,
            }),
        )

        const { promise: aborted, reject: abort } = pDefer<never>()
        const innerIterator = iterable[Symbol.asyncIterator]()
        const iterator: AsyncIterableIterator<ChatResponse> = {
            [Symbol.asyncIterator]: () => iterator,
            next: async () => {
                const result = await Promise.race([innerIterator.next(), aborted])
                if (result.done) {
                    onDone()
                }

                return result
            },
        }

        signal?.addEventListener('abort', () => abort(new CancelError('Request was aborted.')))
        return iterator
    })
}
