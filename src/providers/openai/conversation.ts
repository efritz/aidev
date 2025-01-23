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
    supportsDeveloperMessage: boolean,
): Conversation<ChatCompletionMessageParam> {
    return createGenericConversation<ChatCompletionMessageParam>({
        contextState: contextState,
        userMessageToParam,
        assistantMessagesToParam,
        initialMessage: systemMessageToParam(system, supportsDeveloperMessage),

        // Each time we push a message on the conversation, we check if the last two messages
        // have the same role and are both simple string content payloads, which happens to
        // always be true for user messages by construction.
        //
        // This an expectation from DeepSeek's reasoning models, which does not elegantly hande
        // the initial "system" message immediately followed by an opening user query.
        postPush: (messages: ChatCompletionMessageParam[]) => {
            while (messages.length > 1) {
                const n = messages.length
                const last = messages[n - 1]
                const penultimate = messages[n - 2]

                if (
                    penultimate.role !== last.role ||
                    typeof last.content !== 'string' ||
                    typeof penultimate.content !== 'string'
                ) {
                    break
                }

                penultimate.content = penultimate.content + last.content
                messages.pop()
            }
        },
    })
}

function systemMessageToParam(
    system: string,
    supportsDeveloperMessage: boolean,
): ChatCompletionDeveloperMessageParam | ChatCompletionUserMessageParam {
    return {
        role: supportsDeveloperMessage ? 'developer' : 'user',
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
