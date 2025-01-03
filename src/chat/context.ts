import { ContextStateManager } from '../context/state'
import { Provider } from '../providers/provider'
import { createProvider } from '../providers/providers'
import { InterruptHandler } from '../util/interrupts/interrupts'
import { Prompter } from '../util/prompter/prompter'

export type ChatContext = {
    interruptHandler: InterruptHandler
    prompter: Prompter
    provider: Provider
    contextStateManager: ContextStateManager
}

export async function swapProvider(context: ChatContext, modelName: string): Promise<void> {
    const messages = context.provider.conversationManager.messages()
    context.provider = await createProvider(context.contextStateManager, modelName, context.provider.system)
    context.provider.conversationManager.setMessages(messages)
}

export function canPromptAssistant(context: ChatContext): boolean {
    const messages = context.provider.conversationManager.visibleMessages()
    return messages.length > 0 && messages[messages.length - 1].role === 'user'
}
