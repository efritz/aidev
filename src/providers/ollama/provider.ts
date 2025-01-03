import ollama, { ChatResponse, Message, Tool } from 'ollama'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator, createProvider, Stream } from '../factory'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Ollama'

const models: Model[] = [
    {
        name: 'llama3',
        model: 'llama3.3',
    },
    {
        name: 'qwen',
        model: 'qwen2.5-coder:32b',
    },
]

export const provider: ProviderSpec = {
    providerName,
    models,
    factory: createOllamaProvider,
}

async function createOllamaProvider({
    contextState,
    model: { name: modelName, model },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Promise<Provider> {
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
