import { ContextState } from '../context/state'
import { ConversationManager } from '../conversation/manager'
import { Response } from '../messages/messages'
import { AgentType } from '../tools/tool'
import { Limiter } from '../util/ratelimits/limiter'
import { ChatModel } from './preferences'

export function registerModelLimits(limiter: Limiter, model: ChatModel) {
    limiter.setConfig({
        name: model.model,
        maxPerSecond: model.maxPerSecond,
        maxConcurrent: model.maxConcurrent,
    })
}

export type ProgressFunction = (r?: Response) => void

export type ChatProvider = {
    providerName: string
    modelName: string
    system: string
    conversationManager: ConversationManager
    providerMessages: () => Promise<any[]>
    prompt: (progress?: ProgressFunction, signal?: AbortSignal) => Promise<Response>
}

export type ChatProviderSpec = {
    providerName: string
    models: ChatModel[]
    needsAPIKey: boolean
    factory: ChatProviderFactory
}

export type ChatProviderOptions = {
    contextState: ContextState
    model: ChatModel
    system: string
    temperature?: number
    maxTokens?: number
    allowedTools?: string[]
    agentType: AgentType
}

export type ChatProviderFactory = (opts: ChatProviderOptions) => Promise<ChatProvider>
