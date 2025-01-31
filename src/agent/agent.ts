import { ChatContext } from '../chat/context'
import { createEmptyContextState } from '../context/state'

export interface Agent<T, R> {
    model(context: ChatContext): string | undefined
    buildSystemPrompt(context: ChatContext, args: T): string
    buildUserMessage(context: ChatContext, args: T): string
    processMessage(context: ChatContext, content: string, args: T): Promise<R>
}

export async function runAgent<T, R>(context: ChatContext, agent: Agent<T, R>, args: T): Promise<R | undefined> {
    const model = agent.model(context)
    if (!model) {
        return undefined
    }

    const system = agent.buildSystemPrompt(context, args)
    const userMessage = agent.buildUserMessage(context, args)
    const state = createEmptyContextState()
    const provider = await context.providers.createProvider(state, model, system)

    provider.conversationManager.pushUser({
        type: 'text',
        content: userMessage,
    })

    const response = await provider.prompt()
    const message = response.messages[0]
    const content = message.type === 'text' ? message.content : ''

    return agent.processMessage(context, content, args)
}
