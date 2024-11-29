import { CallToolResult } from '@modelcontextprotocol/sdk/types'
import { createResource, parseResource } from './resource'

export const errorResourceURI = 'aidev://error/'
export const errorResourceMimeType = 'aidev/error'

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

export function parseError(result: CallToolResult): Error | undefined {
    if (!result.isError) {
        return undefined
    }

    return new Error(
        parseResource<string>(result, {
            uri: errorResourceURI,
            mimeType: errorResourceMimeType,
        }) ?? 'Unknown error',
    )
}
