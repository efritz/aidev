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
    conversationManager: ConversationManager
    prompt: (progress?: ProgressFunction, abortRegisterer?: AbortRegisterer) => Promise<Response>
}

export type ProviderSpec = {
    models: Model[]
    factory: ProviderFactory
}

export type ProviderOptions = {
    model: Model
    system: string
    temperature?: number
    maxTokens?: number
}

export type ProviderFactory = (opts: ProviderOptions) => Provider
