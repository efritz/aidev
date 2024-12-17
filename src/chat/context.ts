import { ContextStateManager } from '../context/state'
import { Provider } from '../providers/provider'
import { InterruptHandler } from '../util/interrupts/interrupts'
import { Prompter } from '../util/prompter/prompter'

export type ChatContext = {
    interruptHandler: InterruptHandler
    prompter: Prompter
    provider: Provider
    contextStateManager: ContextStateManager
}

export function canPromptAssistant(context: ChatContext): boolean {
    const messages = context.provider.conversationManager.visibleMessages()
    return messages.length > 0 && messages[messages.length - 1].role === 'user'
}
