import { ChatCompletionChunk } from 'openai/resources'
import { AssistantMessage, ToolUse } from '../../messages/messages'
import { Reducer } from '../reducer'

export function createStreamReducer(): Reducer<ChatCompletionChunk> {
    const messages: AssistantMessage[] = []

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
