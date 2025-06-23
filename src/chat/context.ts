import { ContextStateManager } from '../context/state'
import { createSQLiteEmbeddingsStore, EmbeddingsStore } from '../indexing/store'
import { ChatProvider } from '../providers/chat_provider'
import { ChatProviders } from '../providers/chat_providers'
import { EmbeddingsProviders } from '../providers/embeddings_providers'
import { Preferences } from '../providers/preferences'
import { Rule } from '../rules/types'
import { Container } from '../util/docker/container'
import { InterruptHandler } from '../util/interrupts/interrupts'
import { Prompter } from '../util/prompter/prompter'
import { UsageTracker } from '../util/usage/tracker'

export type ChatContext = {
    preferences: Preferences
    rules: Rule[]
    providers: ChatProviders
    embeddingsClients: EmbeddingsProviders
    tracker: UsageTracker
    interruptHandler: InterruptHandler
    prompter: Prompter
    provider: ChatProvider
    contextStateManager: ContextStateManager
    yolo: boolean
    tools: string[]
    container?: Container
}

export async function swapProvider(context: ChatContext, modelName: string): Promise<void> {
    const provider = await context.providers.createProvider({
        contextState: context.contextStateManager,
        modelName,
        system: context.provider.system,
        allowedTools: context.tools,
        agentType: 'main',
    })

    const messages = context.provider.conversationManager.messages()
    context.provider = provider
    context.provider.conversationManager.setMessages(messages)
}

export function canPromptAssistant(context: ChatContext): boolean {
    const messages = context.provider.conversationManager.visibleMessages()
    return messages.length > 0 && messages[messages.length - 1].role === 'user'
}

let storeOnce: Promise<EmbeddingsStore> | undefined = undefined

export async function embeddingsStore(context: ChatContext): Promise<EmbeddingsStore> {
    if (!storeOnce) {
        const embeddingsModel = context.preferences.embeddingsModel
        const client = await context.embeddingsClients.createProvider(embeddingsModel)
        storeOnce = createSQLiteEmbeddingsStore(client)
    }

    return storeOnce
}
