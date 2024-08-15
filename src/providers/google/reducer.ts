import { EnhancedGenerateContentResponse } from '@google/generative-ai'
import { AssistantMessage } from '../../messages/messages'
import { Reducer } from '../reducer'

export function createStreamReducer(): Reducer<EnhancedGenerateContentResponse> {
    const messages: AssistantMessage[] = []

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

        const functionCalls = part.functionCalls() || []
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

    return { messages, handleEvent }
}
