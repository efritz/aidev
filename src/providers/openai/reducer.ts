import { ChatCompletion, ChatCompletionChunk } from 'openai/resources'
import { AssistantMessage, ToolUse } from '../../messages/messages'
import { createEventLogger } from '../../util/log/event_logger'
import { ModelTracker } from '../../util/usage/tracker'
import { Reducer } from '../reducer'

const eventLogger = createEventLogger('OPENAI_EVENT_LOG_FILE')

export function createStreamReducer(tracker: ModelTracker): Reducer<ChatCompletionChunk> {
    const messages: AssistantMessage[] = []
    eventLogger.logEvent({ type: 'stream_created' })

    const handleTextChunk = (content: string) => {
        const last = messages[messages.length - 1]
        if (last && last.type === 'text') {
            last.content += content
        } else {
            messages.push({ type: 'text', content })
        }
    }

    const handleToolCallChunk = (toolCalls: ChatCompletionChunk.Choice.Delta.ToolCall[]) => {
        const last = messages[messages.length - 1]
        if (last && last.type === 'tool_use') {
            for (const call of toolCalls) {
                const prev = last.tools[call.index]

                last.tools[call.index] = {
                    id: (prev?.id ?? '') + (call.id ?? ''),
                    name: (prev?.name ?? '') + (call.function?.name ?? ''),
                    parameters: (prev?.parameters ?? '') + (call.function?.arguments ?? ''),
                }
            }
        } else {
            const tools: ToolUse[] = []
            for (const call of toolCalls) {
                tools[call.index] = {
                    id: call.id ?? '',
                    name: call.function?.name ?? '',
                    parameters: call.function?.arguments ?? '',
                }
            }

            messages.push({ type: 'tool_use', tools })
        }
    }

    const handleEvent = (message: ChatCompletionChunk) => {
        eventLogger.logEvent(message)

        const usage = message.usage
        if (usage) {
            tracker.add({ inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens })
        }

        if (message.choices.length > 0) {
            const { content, tool_calls: toolCalls } = message.choices[0].delta

            if (content) {
                handleTextChunk(content)
            }

            if (toolCalls) {
                handleToolCallChunk(toolCalls)
            }
        }
    }

    return { messages, handleEvent }
}

export function toChunk({ choices, ...rest }: ChatCompletion): ChatCompletionChunk {
    return {
        ...rest,
        choices: choices.map(toChunkChoice),
        object: 'chat.completion.chunk',
    }
}

function toChunkChoice({
    message: { tool_calls, ...messageRest },
    ...choiceRest
}: ChatCompletion.Choice): ChatCompletionChunk.Choice {
    return {
        ...choiceRest,
        delta: {
            ...messageRest,
            function_call: undefined, // deprecated; eliminate null value
            tool_calls: tool_calls?.map((call, index) => ({ ...call, index })),
        },
    }
}
