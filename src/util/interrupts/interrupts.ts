import readline from 'readline'

export interface InterruptHandler {
    withInterruptHandler: <T>(f: (signal: AbortSignal) => Promise<T>, options?: InterruptHandlerOptions) => Promise<T>
}

type Handler = {
    permanent: boolean
    onAbort: () => void
}

export type InterruptHandlerOptions = Partial<Handler> & {
    throwOnCancel?: boolean
}

export class CancelError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'CancelError'
    }
}

export function createInterruptHandler(rl: readline.Interface) {
    const handlers: Handler[] = []

    const register = (handler: Handler) => {
        if (handler.permanent) {
            rl.on('SIGINT', handler.onAbort)
        } else {
            rl.once('SIGINT', handler.onAbort)
        }
    }

    const unregister = (handler: Handler) => {
        rl.off('SIGINT', handler.onAbort)
    }

    const push = (handler: Handler) => {
        const current = handlers[handlers.length - 1]
        if (current && !current.permanent) {
            unregister(current)
        }

        register(handler)
        handlers.push(handler)
    }

    const pop = () => {
        const top = handlers.pop()
        unregister(top!)

        const previous = handlers[handlers.length - 1]
        if (previous && !previous.permanent) {
            register(previous)
        }
    }

    const withInterruptHandler = async <T>(
        f: (signal: AbortSignal) => Promise<T>,
        { permanent = false, onAbort, throwOnCancel = true }: InterruptHandlerOptions = {},
    ): Promise<T> => {
        let canceled = false
        const controller = new AbortController()

        push({
            permanent,
            onAbort: () => {
                canceled = true
                controller.abort()
                onAbort?.()
            },
        })

        try {
            return await f(controller.signal)
        } finally {
            pop()

            if (throwOnCancel && canceled) {
                throw new CancelError('User canceled.')
            }
        }
    }

    return { withInterruptHandler }
}
