import { Content, Part } from '@google/generative-ai'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

export function createConversation(): Conversation<Content> {
    return createGenericConversation<Content>({
        userMessageToParam,
        assistantMessagesToParam,
    })
}

function userMessageToParam(message: UserMessage): Content {
    switch (message.type) {
        case 'text': {
            return {
                role: 'user',
                parts: [{ text: message.content }],
            }
        }

        case 'tool_result': {
            return {
                role: 'function',
                parts: [
                    {
                        functionResponse: {
                            name: message.toolUse.name,
                            response: JSON.parse(serializeToolResult(message.toolUse.name, message)),
                        },
                    },
                ],
            }
        }
    }
}

function assistantMessagesToParam(messages: AssistantMessage[]): Content {
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

    return { role: 'model', parts }
}
