import { ChatCompletionChunk } from 'groq-sdk/resources/chat/completions'
import { AssistantMessage } from '../../messages/messages'
import { createEventLogger } from '../../util/log/event_logger'
import { ModelTracker } from '../../util/usage/tracker'
import { Reducer } from '../reducer'

const eventLogger = createEventLogger('GROQ_EVENT_LOG_FILE')

export function createStreamReducer(tracker: ModelTracker): Reducer<ChatCompletionChunk> {
    const messages: AssistantMessage[] = []
    eventLogger.logEvent({ type: 'stream_created' })

    const handleTextChunk = (content: string) => {
        const last = messages[messages.length - 1]
        if (last && last.type === 'text') {
            last.content += content
        } else {
            messages.push({ type: 'text', content: content })
        }
    }

    const handleToolCallChunk = (toolCalls: ChatCompletionChunk.Choice.Delta.ToolCall[]) => {
        const last = messages[messages.length - 1]
        if (last && last.type === 'tool_use') {
            while (last.tools.length < toolCalls.length) {
                last.tools.push({
                    id: toolCalls[last.tools.length].id || '',
                    name: '',
                    parameters: '',
                })
            }

            for (const call of toolCalls) {
                last.tools[call.index].name += call.function?.name || ''
                last.tools[call.index].parameters += call.function?.arguments || ''
            }
        } else {
            messages.push({
                type: 'tool_use',
                tools: toolCalls.map(call => ({
                    id: call.id || '',
                    name: call.function?.name || '',
                    parameters: call.function?.arguments || '',
                })),
            })
        }
    }

    const handleEvent = (message: ChatCompletionChunk) => {
        eventLogger.logEvent(message)

        const usage = message.x_groq?.usage
        if (usage) {
            tracker.add({ inputTokens: usage.prompt_tokens, outputTokens: usage.completion_time })
        }

        const { content, tool_calls: toolCalls } = message.choices[0].delta
        if (content) {
            handleTextChunk(content)
        }
        if (toolCalls) {
            handleToolCallChunk(toolCalls)
        }
    }

    return { messages, handleEvent }
}
