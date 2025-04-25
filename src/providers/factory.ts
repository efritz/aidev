import { Conversation } from '../conversation/conversation'
import { ChatProvider, ProgressFunction } from './chat_provider'
import { Reducer, reduceStream } from './reducer'

export type Stream<T> = AsyncIterable<T>
export type StreamFactory<T, R> = (messages: R[], signal?: AbortSignal) => Promise<Stream<T>>
export type ReducerFactory<T> = () => Reducer<T>
export type ConversationFactory<T> = () => Conversation<T>

export type ChatProviderOptions<T, R> = {
    providerName: string
    modelName: string
    system: string
    createStream: StreamFactory<T, R>
    createStreamReducer: ReducerFactory<T>
    createConversation: ConversationFactory<R>
}

export function createChatProvider<T, M>({
    providerName,
    modelName,
    system,
    createStream,
    createStreamReducer,
    createConversation,
}: ChatProviderOptions<T, M>): ChatProvider {
    const { providerMessages, ...conversationManager } = createConversation()

    return {
        providerName,
        modelName,
        system,
        conversationManager,
        providerMessages,
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
