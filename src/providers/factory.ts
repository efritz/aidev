import { Conversation } from '../conversation/conversation'
import { CancelError } from '../util/interrupts/interrupts'
import { invertPromise } from '../util/promises/promise'
import { Aborter, AbortRegisterer, ProgressFunction, Provider } from './provider'
import { Reducer, reduceStream } from './reducer'

export type Stream<T> = { iterator: AsyncIterable<T>; abort: Aborter }
export type StreamFactory<T, R> = (messages: R[]) => Promise<Stream<T>>
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
        prompt: async (progress?: ProgressFunction, abortRegisterer?: AbortRegisterer) => {
            const { iterator, abort } = await createStream(providerMessages())
            abortRegisterer?.(abort)

            const response = await reduceStream({
                iterator,
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

export function abortableIterator<T>(iterable: AsyncIterable<T>, abortIterable: () => void): Stream<T> {
    const { promise: aborted, reject: abort } = invertPromise()
    const innerIterator = iterable[Symbol.asyncIterator]()
    const iterator: AsyncIterableIterator<T> = {
        [Symbol.asyncIterator]: () => iterator, // return self
        next: () => Promise.race([innerIterator.next(), aborted]), // AsyncIterator
    }

    return {
        iterator,
        abort: () => {
            abortIterable()
            abort(new CancelError('Provider stream canceled'))
        },
    }
}
