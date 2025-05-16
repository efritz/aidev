import { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types.js'
import { createResource, parseResource } from './resource'

const progressResultURI = 'aidev://progress/'
const progressResultMimeType = 'aidev/progress'

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
