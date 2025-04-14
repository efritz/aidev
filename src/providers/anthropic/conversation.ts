import {
    MessageParam,
    TextBlockParam,
    ToolResultBlockParam,
    ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/messages'
import { ContextState } from '../../context/state'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

type UserContent = TextBlockParam | ToolResultBlockParam
type AssistantContent = TextBlockParam | ToolUseBlockParam
type Content = UserContent | AssistantContent
type UserParam = { role: 'user'; content: UserContent[] }
type AssistantParam = { role: 'assistant'; content: AssistantContent[] }
type Params = { role: 'user' | 'assistant'; content: Content[] }

export function createConversation(contextState: ContextState): Conversation<MessageParam> {
    return createGenericConversation<Params>({
        contextState,
        userMessageToParam,
        assistantMessagesToParam,

        // Each time we push a message on the conversation, we check if the last two messages
        // have the same role. If so, we'll merge them together so that we have alternating
        // user and assistant roles, as the Anthropic API expects.
        postPush: (messages: Params[]) => {
            while (messages.length > 1) {
                const n = messages.length
                const last = messages[n - 1]
                const penultimate = messages[n - 2]

                if (penultimate.role !== last.role) {
                    break
                }

                penultimate.content.push(...last.content)
                messages.pop()
            }
        },
    })
}

function userMessageToParam(message: UserMessage): UserParam[] {
    switch (message.type) {
        case 'text': {
            return [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: message.content,
                        },
                    ],
                },
            ]
        }

        case 'tool_result': {
            const { result, suggestions } = serializeToolResult(message.toolUse.name, message)

            const messages: UserParam[] = [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: message.toolUse.id,
                            content: JSON.stringify(result),
                            is_error: !!message.error,
                        },
                    ],
                },
            ]

            if (suggestions) {
                messages.push({
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: suggestions,
                        },
                    ],
                })
            }

            return messages
        }
    }
}

function assistantMessagesToParam(messages: AssistantMessage[]): AssistantParam[] {
    return [
        {
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
        },
    ]
}
