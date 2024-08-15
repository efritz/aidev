import {
    MessageParam,
    TextBlockParam,
    ToolResultBlockParam,
    ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/messages'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

type UserContent = TextBlockParam | ToolResultBlockParam
type AssistantContent = TextBlockParam | ToolUseBlockParam
type Content = UserContent | AssistantContent
type UserParam = { role: 'user'; content: UserContent[] }
type AssistantParam = { role: 'assistant'; content: AssistantContent[] }
type Params = { role: 'user' | 'assistant'; content: Content[] }

export function createConversation(): Conversation<MessageParam> {
    return createGenericConversation<Params>({
        userMessageToParam,
        assistantMessagesToParam,
        postPush: (messages: Params[]) => {
            while (messages.length > 1) {
                const n = messages.length
                const last = messages[n - 1]
                const penultimate = messages[n - 2]

                if (penultimate.role === last.role) {
                    penultimate.content.push(...last.content)
                    messages.pop()
                } else {
                    break
                }
            }
        },
    })
}

function userMessageToParam(message: UserMessage): UserParam {
    switch (message.type) {
        case 'text': {
            return {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: message.content,
                    },
                ],
            }
        }

        case 'tool_result': {
            return {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: message.toolUse.id,
                        content: serializeToolResult(message.toolUse.name, message),
                        is_error: !!message.error,
                    },
                ],
            }
        }
    }
}

function assistantMessagesToParam(messages: AssistantMessage[]): AssistantParam {
    return {
        role: 'assistant',
        content: messages.flatMap((message): AssistantContent[] => {
            switch (message.type) {
                case 'text': {
                    return [
                        {
                            type: 'text',
                            text: message.content,
                        },
                    ]
                }

                case 'tool_use': {
                    return message.tools.map(({ id, name, parameters }) => ({
                        type: 'tool_use',
                        id,
                        name,
                        input: parameters ? JSON.parse(parameters) : {},
                    }))
                }
            }
        }),
    }
}
