import pDefer from 'p-defer'
import { CancelError } from '../interrupts/interrupts'

export function toIterable<T>(factory: () => Promise<T>): AsyncIterable<T> {
    async function* createIterable() {
        yield await factory()
    }

    return createIterable()
}

export async function* finalizingIterable<T>(iterable: AsyncIterable<T>, onDone: () => void): AsyncIterable<T> {
    try {
        for await (const item of iterable) {
            yield item
        }
    } finally {
        onDone()
    }
}

export async function* abortableIterable<T>(iterable: AsyncIterable<T>, signal?: AbortSignal): AsyncIterable<T> {
    if (!signal) {
        return iterable
    }

    const iterator = iterable[Symbol.asyncIterator]()
    const { promise: abortPromise, reject } = pDefer<never>()
    signal.addEventListener('abort', () => reject(new CancelError('Request was aborted.')), { once: true })

    while (true) {
        if (signal.aborted) {
            throw new CancelError('Request was aborted.')
        }

        const result = await Promise.race([iterator.next(), abortPromise])
        if (result.done) {
            break
        }

        yield result.value
    }
}
