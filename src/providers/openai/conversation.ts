import {
    ChatCompletionAssistantMessageParam,
    ChatCompletionDeveloperMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionMessageToolCall,
    ChatCompletionSystemMessageParam,
    ChatCompletionToolMessageParam,
    ChatCompletionUserMessageParam,
} from 'openai/resources'
import { ContextState } from '../../context/state'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

type UserParam = ChatCompletionUserMessageParam | ChatCompletionToolMessageParam
type AssistantParam = ChatCompletionAssistantMessageParam

type systemMessageRole = 'developer' | 'system' | 'user'

export function createConversation(
    contextState: ContextState,
    system: string,
    systemMessageRole: systemMessageRole = 'developer',
): Conversation<ChatCompletionMessageParam> {
    return createGenericConversation<ChatCompletionMessageParam>({
        contextState: contextState,
        userMessageToParam,
        assistantMessagesToParam,
        initialMessage: systemMessageToParam(system, systemMessageRole),
    })
}

function systemMessageToParam(
    system: string,
    systemMessageRole: systemMessageRole,
): (ChatCompletionDeveloperMessageParam | ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam)[] {
    return [
        {
            role: systemMessageRole,
            content: system,
        },
    ]
}

function userMessageToParam(message: UserMessage): UserParam[] {
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

            const messages: UserParam[] = [
                {
                    role: 'tool',
                    tool_call_id: message.toolUse.id,
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

function assistantMessagesToParam(messages: AssistantMessage[]): AssistantParam[] {
    const content: string[] = []
    const toolCalls: ChatCompletionMessageToolCall[] = []

    for (const message of messages) {
        switch (message.type) {
            case 'text': {
                content.push(message.content)
                break
            }

            case 'tool_use': {
                toolCalls.push(
                    ...message.tools.map(
                        ({ id, name, parameters }): ChatCompletionMessageToolCall => ({
                            type: 'function',
                            id,
                            function: {
                                name,
                                arguments: parameters,
                            },
                        }),
                    ),
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
