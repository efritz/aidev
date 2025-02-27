import { EmbeddingsModel } from '../../providers/preferences'
import { Limiter } from '../../util/ratelimits/limiter'

export type Model = EmbeddingsModel

export function registerModelLimits(limiter: Limiter, model: Model) {
    limiter.setConfig({
        name: model.model,
        maxPerSecond: model.maxPerSecond,
        maxConcurrent: model.maxConcurrent,
    })
}

export interface Client {
    providerName: string
    modelName: string
    dimensions: number
    maxInput: number
    embed: (input: string[], signal?: AbortSignal) => Promise<number[][]>
}

export interface ClientSpec {
    providerName: string
    models: Model[]
    needsAPIKey: boolean
    factory: ClientFactory
}

export type ClientOptions = {
    model: Model
}

export type ClientFactory = (opts: ClientOptions) => Promise<Client>
