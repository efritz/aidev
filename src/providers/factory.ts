import { Conversation } from '../conversation/conversation'
import { ProgressFunction, Provider } from './provider'
import { Reducer, reduceStream } from './reducer'

export type Stream<T> = AsyncIterable<T>
export type StreamFactory<T, R> = (messages: R[], signal?: AbortSignal) => Promise<Stream<T>>
export type ReducerFactory<T> = () => Reducer<T>
export type ConversationFactory<T> = () => Conversation<T>

export type ProviderOptions<T, R> = {
    providerName: string
    modelName: string
    system: string
    createStream: StreamFactory<T, R>
    createStreamReducer: ReducerFactory<T>
    createConversation: ConversationFactory<R>
}

export function createProvider<T, M>({
    providerName,
    modelName,
    system,
    createStream,
    createStreamReducer,
    createConversation,
}: ProviderOptions<T, M>): Provider {
    const { providerMessages, ...conversationManager } = createConversation()

    return {
        providerName,
        modelName,
        system,
        conversationManager,
        prompt: async (progress?: ProgressFunction, signal?: AbortSignal) => {
            const response = await reduceStream({
                iterator: await createStream(providerMessages(), signal),
                reducer: createStreamReducer(),
                progress,
            })

            for (const message of response.messages) {
                conversationManager.pushAssistant(message)
            }

            return response
        },
    }
}
