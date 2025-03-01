import { Limiter } from '../util/ratelimits/limiter'
import { EmbeddingsModel } from './preferences'

export type Model = EmbeddingsModel

export function registerModelLimits(limiter: Limiter, model: Model) {
    limiter.setConfig({
        name: model.model,
        maxPerSecond: model.maxPerSecond,
        maxConcurrent: model.maxConcurrent,
    })
}

export interface EmbeddingsProvider {
    providerName: string
    modelName: string
    dimensions: number
    maxInput: number
    embed: (input: string[], signal?: AbortSignal) => Promise<number[][]>
}

export interface EmbeddingsProviderSpec {
    providerName: string
    models: Model[]
    needsAPIKey: boolean
    factory: EmbeddingsProviderFactory
}

export type EmbeddingsProviderOptions = {
    model: Model
}

export type EmbeddingsProviderFactory = (opts: EmbeddingsProviderOptions) => Promise<EmbeddingsProvider>
