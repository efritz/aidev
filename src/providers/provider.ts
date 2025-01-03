import { ContextState } from '../context/state'
import { ConversationManager } from '../conversation/conversation'
import { Response } from '../messages/messages'

export type Model = {
    name: string
    model: string
    options?: any
}

export type Aborter = () => void
export type AbortRegisterer = (abort: Aborter) => void
export type ProgressFunction = (r?: Response) => void

export type Provider = {
    providerName: string
    modelName: string
    system: string
    conversationManager: ConversationManager
    prompt: (progress?: ProgressFunction, abortRegisterer?: AbortRegisterer) => Promise<Response>
}

export type ProviderSpec = {
    providerName: string
    models: Model[]
    factory: ProviderFactory
}

export type ProviderOptions = {
    contextState: ContextState
    model: Model
    system: string
    temperature?: number
    maxTokens?: number
}

export type ProviderFactory = (opts: ProviderOptions) => Promise<Provider>
