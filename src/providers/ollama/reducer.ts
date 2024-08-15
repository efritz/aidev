import { ChatResponse, ToolCall } from 'ollama'
import { AssistantMessage } from '../../messages/messages'
import { Reducer } from '../reducer'

export function createStreamReducer(): Reducer<ChatResponse> {
    const messages: AssistantMessage[] = []

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

    const handleEvent = ({ message: { content, tool_calls: toolCalls } }: ChatResponse) => {
        if (content !== '') {
            handleTextChunk(content)
        }
        if (toolCalls) {
            handleToolCallChunk(toolCalls)
        }
    }

    return { messages, handleEvent }
}
