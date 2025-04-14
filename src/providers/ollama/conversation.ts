import { Message as OllamaMessage, ToolCall } from 'ollama'
import { ContextState } from '../../context/state'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

export function createConversation(contextState: ContextState, system: string): Conversation<OllamaMessage> {
    return createGenericConversation({
        contextState: contextState,
        userMessageToParam,
        assistantMessagesToParam,
        initialMessage: systemMessageToParam(system),
    })
}

function systemMessageToParam(system: string): OllamaMessage[] {
    return [
        {
            role: 'system',
            content: system,
        },
    ]
}

function userMessageToParam(message: UserMessage): OllamaMessage[] {
    switch (message.type) {
        case 'text': {
            return [
                {
                    role: 'user',
                    content: message.content,
                },
            ]
        }

        case 'tool_result': {
            const { result, suggestions } = serializeToolResult(message.toolUse.name, message)

            const messages: OllamaMessage[] = [
                {
                    role: 'user',
                    content: JSON.stringify(result),
                },
            ]

            if (suggestions) {
                messages.push({
                    role: 'user',
                    content: suggestions,
                })
            }

            return messages
        }
    }
}

function assistantMessagesToParam(messages: AssistantMessage[]): OllamaMessage[] {
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

    return [
        {
            role: 'assistant',
            content: content.join('\n'),
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
    ]
}
