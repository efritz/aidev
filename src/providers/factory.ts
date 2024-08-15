import { ConversationManager } from '../conversation/conversation'
import { CancelError } from '../util/interrupts/interrupts'
import { invertPromise } from '../util/promise'
import { Aborter, AbortRegisterer, ProgressFunction, Provider } from './provider'
import { Reducer, reduceStream } from './reducer'

export type Stream<T> = { iterator: AsyncIterable<T>; abort: Aborter }
export type StreamFactory<T> = () => Promise<Stream<T>>
export type ReducerFactory<T> = () => Reducer<T>

export type ProviderOptions<T> = {
    createStream: StreamFactory<T>
    createStreamReducer: ReducerFactory<T>
    conversationManager: ConversationManager
}

export function createProvider<T>({
    createStream,
    createStreamReducer,
    conversationManager,
}: ProviderOptions<T>): Provider {
    const prompt = async (progress?: ProgressFunction, abortRegisterer?: AbortRegisterer) => {
        const { iterator, abort } = await createStream()
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
    }

    return { conversationManager, prompt }
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
