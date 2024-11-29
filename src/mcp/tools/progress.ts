import { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types'
import { createResource, parseResource } from './resource'

export const progressResultURI = 'aidev://progress/'
export const progressResultMimeType = 'aidev/progress'

export function progressToResult(progress: Progress): CallToolResult {
    return {
        content: [createResource(progressResultURI, progressResultMimeType, progress)],
    }
}

export function parseProgress(result: CallToolResult): Progress | undefined {
    return parseResource<Progress>(result, {
        uri: progressResultURI,
        mimeType: progressResultMimeType,
    })
}
