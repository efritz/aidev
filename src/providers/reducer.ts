import { AssistantMessage, Response } from '../messages/messages'
import { ProgressFunction } from './chat_provider'

export type Reducer<T> = {
    messages: AssistantMessage[]
    handleEvent: (e: T) => void
    flush?: () => void
}

type ReducerOptions<T> = {
    iterator: AsyncIterable<T>
    reducer: Reducer<T>
    progress?: ProgressFunction
}

export async function reduceStream<T>({ iterator, reducer, progress }: ReducerOptions<T>): Promise<Response> {
    const { messages, handleEvent, flush } = reducer

    for await (const message of iterator) {
        handleEvent(message)
        progress?.({ messages })
    }

    flush?.()

    return { messages }
}
