import { ChatResponse, ToolCall } from 'ollama'
import { AssistantMessage } from '../../messages/messages'
import { createEventLogger } from '../../util/log/event_logger'
import { Reducer } from '../reducer'

const eventLogger = createEventLogger('OLLAMA_EVENT_LOG_FILE')

export function createStreamReducer(): Reducer<ChatResponse> {
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

    const handleToolCallChunk = (toolCalls: ToolCall[]) => {
        messages.push({
            type: 'tool_use',
            tools: toolCalls.map(({ function: { name, arguments: args } }) => ({
                id: '',
                name,
                parameters: JSON.stringify(args),
            })),
        })
    }

    const handleEvent = (message: ChatResponse) => {
        eventLogger.logEvent(message)

        if (message.message.content !== '') {
            handleTextChunk(message.message.content)
        }
        if (message.message.tool_calls) {
            handleToolCallChunk(message.message.tool_calls)
        }
    }

    return { messages, handleEvent }
}
