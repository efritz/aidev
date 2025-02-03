import ollama, { ChatResponse, Message, Tool } from 'ollama'
import { tools as toolDefinitions } from '../../tools/tools'
import { toIterable } from '../../util/iterable/iterable'
import { abortableIterator, createProvider, Stream } from '../factory'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createOllamaProviderSpec(preferences: Preferences): Promise<ProviderSpec> {
    const providerName = 'Ollama'

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: false,
        factory: createOllamaProvider(providerName),
    }
}

function createOllamaProvider(providerName: string): ProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
        const { providerMessages, ...conversationManager } = createConversation(contextState, system)

        return createProvider({
            providerName,
            modelName,
            system,
            createStream: () =>
                createStream({
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
    model,
    messages,
    temperature,
    maxTokens,
    disableTools,
}: {
    model: string
    messages: Message[]
    temperature?: number
    maxTokens?: number
    disableTools?: boolean
}): Promise<Stream<ChatResponse>> {
    // https://github.com/ollama/ollama-js/issues/123
    const iterable = toIterable(async () =>
        ollama.chat({
            model,
            messages,
            options: {
                temperature,
                num_predict: maxTokens,
            },
            tools: disableTools
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
                  ),
        }),
    )

    return abortableIterator(iterable, () => {})
}
