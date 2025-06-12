import { Content, Part } from '@google/generative-ai'
import { ContextState } from '../../context/state'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

export function createConversation(contextState: ContextState): Conversation<Content> {
    return createGenericConversation<Content>({
        contextState,
        userMessageToParam,
        assistantMessagesToParam,
    })
}

function userMessageToParam(message: UserMessage): Content[] {
    switch (message.type) {
        case 'text': {
            return [
                {
                    role: 'user',
                    parts: [{ text: message.content }],
                },
            ]
        }

        case 'tool_result': {
            const messages: Content[] = []
            const allSuggestions: string[] = []

            for (const toolResult of message.results) {
                const { result, suggestions } = serializeToolResult(toolResult.toolUse.name, toolResult)

                messages.push({
                    role: 'function',
                    parts: [
                        {
                            functionResponse: {
                                name: toolResult.toolUse.name,
                                response: result,
                            },
                        },
                    ],
                })

                if (suggestions) {
                    allSuggestions.push(suggestions)
                }
            }

            if (allSuggestions.length > 0) {
                messages.push({
                    role: 'user',
                    parts: [{ text: allSuggestions.join('\n\n') }],
                })
            }

            return messages
        }
    }
}

function assistantMessagesToParam(messages: AssistantMessage[]): Content[] {
    const parts: Part[] = []
    for (const message of messages) {
        switch (message.type) {
            case 'text': {
                parts.push({ text: message.content })
                break
            }

            case 'tool_use': {
                for (const tool of message.tools) {
                    parts.push({
                        functionCall: {
                            name: tool.name,
                            args: tool.parameters ? JSON.parse(tool.parameters) : {},
                        },
                    })
                }
                break
            }
        }
    }

    return [{ role: 'model', parts }]
}
