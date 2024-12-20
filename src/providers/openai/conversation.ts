import {
    ChatCompletionAssistantMessageParam,
    ChatCompletionDeveloperMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionMessageToolCall,
    ChatCompletionToolMessageParam,
    ChatCompletionUserMessageParam,
} from 'openai/resources'
import { ContextState } from '../../context/state'
import { Conversation, createConversation as createGenericConversation } from '../../conversation/conversation'
import { AssistantMessage, UserMessage } from '../../messages/messages'
import { serializeToolResult } from '../../tools/tools'

type UserParam = ChatCompletionUserMessageParam | ChatCompletionToolMessageParam
type AssistantParam = ChatCompletionAssistantMessageParam

export function createConversation(
    contextState: ContextState,
    system: string,
): Conversation<ChatCompletionMessageParam> {
    return createGenericConversation<ChatCompletionMessageParam>({
        contextState: contextState,
        userMessageToParam,
        assistantMessagesToParam,
        initialMessage: systemMessageToParam(system),
    })
}

function systemMessageToParam(system: string): ChatCompletionDeveloperMessageParam {
    return {
        role: 'developer',
        content: system,
    }
}

function userMessageToParam(message: UserMessage): UserParam {
    switch (message.type) {
        case 'text': {
            return {
                role: 'user',
                content: message.content,
            }
        }

        case 'tool_result': {
            return {
                role: 'tool',
                tool_call_id: message.toolUse.id,
                content: serializeToolResult(message.toolUse.name, message),
            }
        }
    }
}

function assistantMessagesToParam(messages: AssistantMessage[]): AssistantParam {
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

    return {
        role: 'assistant',
        content: content.join('\n'),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    }
}
