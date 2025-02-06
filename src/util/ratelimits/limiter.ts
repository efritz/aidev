export interface Limiter {
    setConfig(config: LimitConfig): void
    wrap<T extends (...args: any[]) => any>(name: string, f: T): T
}

export type LimitConfig = {
    name: string
    maxPerSecond?: number
    maxConcurrent?: number
}

export function createLimiter(): Limiter {
    const configs = new Map<string, LimitConfig>()

    return {
        setConfig: config => {
            if (configs.has(config.name)) {
                throw new Error(`Limit config already set for ${config.name}`)
            }

            configs.set(config.name, config)
        },
        wrap: (name, f) => {
            const wrapper = (...args: Parameters<typeof f>): ReturnType<typeof f> => {
                const config = configs.get(name)
                if (!config) {
                    return f(...args)
                }

                // TODO
                throw new Error('Limits unimplemented')
            }

            return wrapper as typeof f
        },
    }
}
