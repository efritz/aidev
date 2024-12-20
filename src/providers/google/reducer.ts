import { EnhancedGenerateContentResponse, FunctionCall } from '@google/generative-ai'
import { AssistantMessage } from '../../messages/messages'
import { Reducer } from '../reducer'

export function createStreamReducer(): Reducer<EnhancedGenerateContentResponse> {
    const messages: AssistantMessage[] = []
    const functionCalls: FunctionCall[] = []

    const handleEvent = (part: EnhancedGenerateContentResponse) => {
        const text = part.text()
        if (text) {
            const last = messages[messages.length - 1]
            if (last && last.type === 'text') {
                last.content += text
            } else {
                messages.push({ type: 'text', content: text })
            }
        }

        // Gemini models have the tendency to emit a single newline after a function
        // call if there was no text before the tool call, which causes the conversation
        // to become malformed as the tool result does not immediately follow the call.
        //
        // Buffering the function calls ensures that we'll emit them last.

        functionCalls.push(...(part.functionCalls() || []))
    }

    const flush = () => {
        if (functionCalls.length > 0) {
            messages.push({
                type: 'tool_use',
                tools: functionCalls.map(functionCall => ({
                    id: '',
                    name: functionCall.name,
                    parameters: JSON.stringify(functionCall.args),
                })),
            })
        }
    }

    return { messages, handleEvent, flush }
}
