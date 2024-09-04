import { createEmptyContextState } from '../context/state'
import { createProvider } from '../providers/providers'
import { ChatContext } from './context'

const reprompterModel = 'haiku'

function buildSystemPrompt(context: ChatContext): string {
    return `
    You are a sub-agent responsible for determining whether an AI assistant has completed its response or if it should be re-prompted after using a tool.

    <conversation>
    ${JSON.stringify(context.provider.conversationManager.visibleMessages())}
    </conversation>

    Respond with only DONE or REPROMPT.
    `
}

export async function shouldReprompt(context: ChatContext): Promise<boolean> {
    const system = buildSystemPrompt(context)
    const provider = await createProvider(createEmptyContextState(), reprompterModel, system)
    provider.conversationManager.pushUser({
        type: 'text',
        content: 'Is the assistant finished?',
    })

    const response = await provider.prompt()
    return response.messages[0].type === 'text'
        ? response.messages[0].content.toLowerCase().trim() === 'reprompt'
        : false
}
