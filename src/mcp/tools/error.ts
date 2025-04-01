import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { createResource, parseResource } from './resource'

const errorResourceURI = 'aidev://error/'
const errorResourceMimeType = 'aidev/error'

export function errorToResult(error: any): CallToolResult {
    return {
        isError: true,
        content: [
            createResource(
                errorResourceURI,
                errorResourceMimeType,
                error instanceof Error ? error.message : String(error),
            ),
        ],
    }
}

export function parseError(contents: CallToolResult['content']): Error | undefined {
    const errorMessage = parseResource<string>(contents, {
        uri: errorResourceURI,
        mimeType: errorResourceMimeType,
    })
    if (!errorMessage) {
        return undefined
    }

    return new Error(errorMessage)
}
