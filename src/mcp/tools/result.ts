import { CallToolResult } from '@modelcontextprotocol/sdk/types'

export function errorToResult(error: any): CallToolResult {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
    }
}

export function resultToError(result: CallToolResult): Error {
    for (const content of result.content) {
        if (content.type === 'text' && content.text.startsWith('Error: ')) {
            return new Error(content.text.substring('Error: '.length))
        }
    }

    return new Error('Unknown error')
}
