import { ContextStateManager } from '../context/state'
import { Preferences } from '../providers/preferences'
import { Provider } from '../providers/provider'
import { Providers } from '../providers/providers'
import { InterruptHandler } from '../util/interrupts/interrupts'
import { Prompter } from '../util/prompter/prompter'

export type ChatContext = {
    preferences: Preferences
    providers: Providers
    interruptHandler: InterruptHandler
    prompter: Prompter
    provider: Provider
    contextStateManager: ContextStateManager
}

export async function swapProvider(context: ChatContext, modelName: string): Promise<void> {
    const messages = context.provider.conversationManager.messages()
    context.provider = await context.providers.createProvider(
        context.contextStateManager,
        modelName,
        context.provider.system,
    )
    context.provider.conversationManager.setMessages(messages)
}

export function canPromptAssistant(context: ChatContext): boolean {
    const messages = context.provider.conversationManager.visibleMessages()
    return messages.length > 0 && messages[messages.length - 1].role === 'user'
}
