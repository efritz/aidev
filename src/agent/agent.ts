import { ChatContext } from '../chat/context'
import { createEmptyContextState } from '../context/state'
import { CancelError } from '../util/interrupts/interrupts'

export interface Agent<T, R> {
    model(context: ChatContext): string
    buildSystemPrompt(context: ChatContext, args: T): Promise<string>
    buildUserMessage(context: ChatContext, args: T): Promise<string>
    processMessage(context: ChatContext, content: string, args: T): Promise<R>
}

export async function runAgent<T, R>(
    context: ChatContext,
    agent: Agent<T, R>,
    args: T,
    signal?: AbortSignal,
    allowedTools?: string[],
): Promise<R> {
    const modelName = agent.model(context)
    const contextState = createEmptyContextState()
    const system = await agent.buildSystemPrompt(context, args)
    const userMessage = await agent.buildUserMessage(context, args)

    const provider = await context.providers.createProvider({
        contextState,
        modelName,
        system,
        allowedTools,
    })

    provider.conversationManager.pushUser({
        type: 'text',
        content: userMessage,
    })

    try {
        const response = await provider.prompt(undefined, signal)
        const message = response.messages[0]
        if (message.type !== 'text') {
            throw new Error(`Unexpected message type ${message.type} from agent.`)
        }

        return await agent.processMessage(context, message.content, args)
    } catch (error: any) {
        if (signal?.aborted) {
            throw new CancelError('Agent aborted.')
        }

        throw error
    }
}
