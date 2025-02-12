import pDefer, { DeferredPromise } from 'p-defer'
import { finalizingIterable } from '../iterable/iterable'
import { finalizingPromise } from '../promise/promise'

type FuncType = (...args: any[]) => any

export interface Limiter {
    setConfig(config: LimitConfig): void
    wrap<T extends FuncType>(
        name: string,
        f: (onDone: () => void) => T,
    ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>
}

export type LimitConfig = {
    name: string
    maxPerSecond?: number
    maxConcurrent?: number
}

type Queue<T extends FuncType> = {
    config: LimitConfig
    tasks: Task<T>[]
    tokens: number
    lastRefill: number
    inFlight: number
    processing: boolean
}

type Task<T extends FuncType> = {
    payload: () => Promise<Awaited<ReturnType<T>>>
    deferred: DeferredPromise<Awaited<ReturnType<T>>>
}

export function createLimiter(): Limiter {
    const queues = new Map<string, Queue<any>>()

    const processQueue = async <T extends FuncType>(queue: Queue<T>): Promise<void> => {
        if (!queue.processing) {
            queue.processing = true

            try {
                await processQueueOnce(queue)
            } finally {
                queue.processing = false
            }
        }
    }

    const processQueueOnce = async <T extends FuncType>(queue: Queue<T>): Promise<void> => {
        const { maxConcurrent, maxPerSecond } = queue.config

        while (queue.tasks.length > 0) {
            if (maxConcurrent && queue.inFlight >= maxConcurrent) {
                break
            }

            if (maxPerSecond) {
                while (queue.tokens < 1) {
                    const now = performance.now()
                    const elapsed = now - queue.lastRefill
                    queue.lastRefill = now
                    queue.tokens += (elapsed * maxPerSecond) / 1000
                    if (queue.tokens > maxPerSecond) {
                        queue.tokens = maxPerSecond
                    }

                    const delay = ((1 - queue.tokens) * 1000) / maxPerSecond
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay))
                    }
                }
            }

            const task = queue.tasks.shift()
            if (task) {
                runOneTask(queue, task)
            }
        }
    }

    const runOneTask = <T extends FuncType>(queue: Queue<T>, { payload, deferred: { resolve, reject } }: Task<T>) => {
        queue.tokens--
        queue.inFlight++

        payload()
            .then(resolve)
            .catch(err => {
                queue.inFlight--
                processQueue(queue)
                reject(err)
            })
    }

    return {
        setConfig: config => {
            if (queues.has(config.name)) {
                throw new Error(`Limit config already set for ${config.name}`)
            }

            queues.set(config.name, {
                config,
                tasks: [],
                tokens: 0,
                lastRefill: performance.now() - 1000,
                inFlight: 0,
                processing: false,
            })
        },
        wrap: <T extends FuncType>(name: string, f: (onDone: () => void) => T) => {
            const wrapper = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
                const queue = queues.get(name)
                if (!queue) {
                    return f(() => {})(...args)
                }

                const onDone = () => {
                    queue.inFlight--
                    processQueue(queue)
                }

                const deferred = pDefer<Awaited<ReturnType<T>>>()
                queue.tasks.push({ payload: () => f(onDone)(...args), deferred })
                processQueue(queue)
                return deferred.promise
            }

            return wrapper as T
        },
    }
}

export function wrapPromise<R, T extends (...args: any[]) => Promise<R>>(
    limiter: Limiter,
    name: string,
    f: T,
): (...args: Parameters<T>) => Promise<R> {
    return limiter.wrap(
        name,
        onDone =>
            (...args) =>
                finalizingPromise(f(...args), onDone),
    )
}

export function wrapAsyncIterable<R, T extends (...args: any[]) => Promise<AsyncIterable<R>>>(
    limiter: Limiter,
    name: string,
    f: T,
): (...args: Parameters<T>) => Promise<AsyncIterable<R>> {
    return limiter.wrap(
        name,
        onDone =>
            async (...args) =>
                finalizingIterable(await f(...args), onDone),
    )
}
