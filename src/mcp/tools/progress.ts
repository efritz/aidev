import { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types.js'
import { createResource, parseResource } from './resource'

export const progressResultURI = 'aidev://progress/'
export const progressResultMimeType = 'aidev/progress'

export function progressToResult(progress: Progress): CallToolResult {
    return {
        content: [createResource(progressResultURI, progressResultMimeType, progress)],
    }
}

export function parseProgress(contents: CallToolResult['content']): Progress | undefined {
    return parseResource<Progress>(contents, {
        uri: progressResultURI,
        mimeType: progressResultMimeType,
    })
}
