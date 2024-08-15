import ollama, { ChatResponse, Message, Tool } from 'ollama'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'llama3',
        model: 'llama3.1',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createOllamaProvider,
}

function createOllamaProvider({
    model: { model },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Provider {
    const { providerMessages, ...conversationManager } = createConversation(system)

    return createProvider({
        createStream: () =>
            createStream({
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
    model,
    messages,
    temperature,
    maxTokens,
}: {
    model: string
    messages: Message[]
    temperature?: number
    maxTokens?: number
}): Promise<Stream<ChatResponse>> {
    async function* createIterable() {
        const response = ollama.chat({
            model,
            messages,
            options: {
                temperature,
                num_predict: maxTokens,
            },
            tools: toolDefinitions.map(
                ({ name, description, parameters }): Tool => ({
                    type: '',
                    function: {
                        name,
                        description,
                        parameters,
                    },
                }),
            ),
        })

        // https://github.com/ollama/ollama-js/issues/123
        yield response
    }

    return abortableIterator(createIterable(), () => {})
}
