import { Limiter } from '../util/ratelimits/limiter'
import { EmbeddingsModel } from './preferences'

export function registerModelLimits(limiter: Limiter, model: EmbeddingsModel) {
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
    models: EmbeddingsModel[]
    needsAPIKey: boolean
    factory: EmbeddingsProviderFactory
}

export type EmbeddingsProviderOptions = {
    model: EmbeddingsModel
}

export type EmbeddingsProviderFactory = (opts: EmbeddingsProviderOptions) => Promise<EmbeddingsProvider>
