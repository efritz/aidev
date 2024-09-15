import { createEmptyContextState } from '../context/state'
import { AssistantMessage, Message, UserMessage } from '../messages/messages'
import { createProvider } from '../providers/providers'
import { ChatContext } from './context'

const reprompterModel = 'sonnet'

export async function shouldReprompt(context: ChatContext): Promise<boolean> {
    const system = buildSystemPrompt(context)
    const provider = await createProvider(createEmptyContextState(), reprompterModel, system)

    provider.conversationManager.pushUser({
        type: 'text',
        content: 'Is the assistant finished?',
    })

    const response = await provider.prompt()
    const answer = response.messages[0].type === 'text' && response.messages[0].content.toLowerCase().trim()
    return answer === 'reprompt'
}

function buildSystemPrompt(context: ChatContext): string {
    const serializedMessages = relevantMessages(context.provider.conversationManager.visibleMessages())
        .map(message => {
            switch (message.role) {
                case 'user': {
                    return userMessageToParam(message)
                }

                case 'assistant': {
                    return assistantMessagesToParam(message)
                }
            }
        })
        .join('\n\n')

    return `
    You are a sub-agent responsible for determining whether an AI assistant has completed its response or if it should be re-prompted after using a tool.

    Consider only the messages from the last user interaction onwards:
    <relevant_messages>
    ${serializedMessages}
    </relevant_messages>

    Respond with only DONE or REPROMPT.
    `
}

function relevantMessages(messages: Message[]): Message[] {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user' && messages[i].type === 'text') {
            return messages.slice(i)
        }
    }

    return []
}

function userMessageToParam(message: UserMessage): string {
    switch (message.type) {
        case 'text': {
            return `User: ${message.content}`
        }

        case 'tool_result': {
            if (message.error) {
                return `User: Tool ${message.toolUse.name} (id = ${message.toolUse.id}) failed: ${JSON.stringify(message.error)}`
            } else {
                return `User: Tool ${message.toolUse.name} (id = ${message.toolUse.id}) result: ${JSON.stringify(message.result)}`
            }
        }
    }
}

function assistantMessagesToParam(message: AssistantMessage): string {
    switch (message.type) {
        case 'text': {
            return `Assistant: ${message.content}`
        }

        case 'tool_use': {
            return message.tools
                .map(({ id, name, parameters }) => {
                    return `Assistant: Calling tool ${name} (id = ${id}) with arguments ${JSON.stringify(parameters)}`
                })
                .join('\n\n')
        }
    }
}
