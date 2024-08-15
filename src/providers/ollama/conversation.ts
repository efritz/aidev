import { Message as OllamaMessage, ToolCall } from 'ollama'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

export function createConversation(system: string): Conversation<OllamaMessage> {
    return createGenericConversation({
        userMessageToParam,
        assistantMessagesToParam,
        initialMessage: systemMessageToParam(system),
    })
}

function systemMessageToParam(system: string): OllamaMessage {
    return {
        role: 'system',
        content: system,
    }
}

function userMessageToParam(message: UserMessage): OllamaMessage {
    switch (message.type) {
        case 'text': {
            return {
                role: 'user',
                content: message.content,
            }
        }

        case 'tool_result': {
            return {
                role: 'user',
                content: serializeToolResult(message.toolUse.name, message),
            }
        }
    }
}

function assistantMessagesToParam(messages: AssistantMessage[]): OllamaMessage {
    const content: string[] = []
    const toolCalls: ToolCall[] = []

    for (const message of messages) {
        switch (message.type) {
            case 'text': {
                content.push(message.content)
                break
            }

            case 'tool_use': {
                toolCalls.push(
                    ...message.tools.map(({ name, parameters }) => ({
                        function: {
                            name,
                            arguments: parameters ? JSON.parse(parameters) : {},
                        },
                    })),
                )

                break
            }
        }
    }

    return {
        role: 'assistant',
        content: content.join('\n'),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    }
}
