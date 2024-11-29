import { CallToolResult, EmbeddedResource } from '@modelcontextprotocol/sdk/types'

export function createResource<T>(uri: string, mimeType: string, content: T): EmbeddedResource {
    return {
        type: 'resource',
        resource: {
            uri: uri,
            mimeType: mimeType,
            blob: Buffer.from(JSON.stringify(content)).toString('base64'),
        },
    }
}

export function parseResource<T>(
    result: CallToolResult,
    selector: {
        uri?: string
        mimeType?: string
    },
): T | undefined {
    for (const content of result.content) {
        if (
            content.type == 'resource' &&
            (!selector.uri || selector.uri === content.resource.uri) &&
            (!selector.mimeType || selector.mimeType === content.resource.mimeType)
        ) {
            return JSON.parse(Buffer.from(content.resource.blob as string, 'base64').toString('utf8')) as T
        }
    }

    return undefined
}
