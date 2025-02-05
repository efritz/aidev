import { ContextStateManager } from '../context/state'
import { EmbeddingsClients } from '../embeddings/client/clients'
import { createSQLiteEmbeddingsStore } from '../embeddings/store/sqlite'
import { EmbeddingsStore } from '../embeddings/store/store'
import { Preferences } from '../providers/preferences'
import { Provider } from '../providers/provider'
import { Providers } from '../providers/providers'
import { InterruptHandler } from '../util/interrupts/interrupts'
import { Prompter } from '../util/prompter/prompter'

export type ChatContext = {
    preferences: Preferences
    providers: Providers
    embeddingsClients: EmbeddingsClients
    interruptHandler: InterruptHandler
    prompter: Prompter
    provider: Provider
    contextStateManager: ContextStateManager
}

export async function swapProvider(context: ChatContext, modelName: string): Promise<void> {
    const provider = await context.providers.createProvider({
        contextState: context.contextStateManager,
        modelName,
        system: context.provider.system,
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
        const client = await context.embeddingsClients.createClient(embeddingsModel)
        storeOnce = createSQLiteEmbeddingsStore(client)
    }

    return storeOnce
}
