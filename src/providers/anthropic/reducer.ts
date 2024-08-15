import {
    RawContentBlockDeltaEvent,
    RawContentBlockStartEvent,
    RawMessageStreamEvent,
} from '@anthropic-ai/sdk/resources'
import { AssistantMessage, TextMessage, ToolUseMessage } from '../../messages/messages'
import { Reducer } from '../reducer'

export function createStreamReducer(): Reducer<RawMessageStreamEvent> {
    const messages: AssistantMessage[] = []
    const last = <T>() => messages[messages.length - 1] as T

    const handleStart = ({ content_block: block }: RawContentBlockStartEvent) => {
        switch (block.type) {
            case 'text': {
                messages.push({ type: 'text', content: '' })
                break
            }

            case 'tool_use': {
                const tool = { id: block.id, name: block.name, parameters: '' }
                messages.push({ type: 'tool_use', tools: [tool] })
                break
            }
        }
    }

    const handleDelta = ({ delta }: RawContentBlockDeltaEvent) => {
        switch (delta.type) {
            case 'text_delta': {
                last<TextMessage>().content += delta.text
                break
            }

            case 'input_json_delta': {
                last<ToolUseMessage>().tools[0].parameters += delta.partial_json
                break
            }
        }
    }

    const handleEvent = (event: RawMessageStreamEvent) => {
        switch (event.type) {
            case 'content_block_start':
                handleStart(event)
                break

            case 'content_block_delta':
                handleDelta(event)
                break
        }
    }

    return { messages, handleEvent }
}
