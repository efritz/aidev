import pDefer, { DeferredPromise } from 'p-defer'

type FuncType = (...args: any[]) => any

export interface Limiter {
    setConfig(config: LimitConfig): void
    wrap<T extends FuncType>(name: string, f: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>
}

export type LimitConfig = {
    name: string
    maxPerSecond?: number
    maxConcurrent?: number
}

type Queue<T extends FuncType> = {
    config: LimitConfig
    tasks: Task<T>[]
    inFlight: number
}

type Task<T extends FuncType> = {
    deferred: DeferredPromise<Awaited<ReturnType<T>>>
    payload: () => Promise<Awaited<ReturnType<T>>>
}

export function createLimiter(): Limiter {
    const queues = new Map<string, Queue<any>>()

    const processQueue = async <T extends FuncType>(queue: Queue<T>): Promise<void> => {
        const task = queue.tasks.shift()
        if (!task) {
            return
        }

        const { deferred, payload } = task

        if (queue.config.maxConcurrent) {
            // TODO
            while (queue.inFlight >= queue.config.maxConcurrent) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

        queue.inFlight++
        payload()
            .then(deferred.resolve, deferred.reject)
            .finally(() => {
                queue.inFlight--
                processQueue(queue)
            })
    }

    return {
        setConfig: config => {
            if (queues.has(config.name)) {
                throw new Error(`Limit config already set for ${config.name}`)
            }

            queues.set(config.name, { config, tasks: [], inFlight: 0 })
        },
        wrap: <T extends FuncType>(name: string, f: T) => {
            const wrapper = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
                const queue = queues.get(name)
                if (!queue) {
                    return f(...args)
                }

                const deferred = pDefer<Awaited<ReturnType<T>>>()
                queue.tasks.push({ deferred, payload: () => f(...args) })
                processQueue(queue)
                return deferred.promise
            }

            return wrapper as typeof f
        },
    }
}
