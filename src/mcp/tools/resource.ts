import { CallToolResult, EmbeddedResource } from '@modelcontextprotocol/sdk/types.js'

export function createResource<T>(uri: string, mimeType: string, content: T): EmbeddedResource {
    return {
        type: 'resource',
        resource: {
            uri: uri,
            mimeType: mimeType,
            blob: encodeBase64(JSON.stringify(content)),
        },
    }
}

export function parseResource<T>(
    contents: CallToolResult['content'],
    selector: {
        uri?: string
        mimeType?: string
    },
): T | undefined {
    for (const content of contents) {
        if (
            content.type === 'resource' &&
            (!selector.uri || selector.uri === content.resource.uri) &&
            (!selector.mimeType || selector.mimeType === content.resource.mimeType)
        ) {
            return JSON.parse(decodeBase64(content.resource.blob as string)) as T
        }
    }

    return undefined
}

function encodeBase64(content: string): string {
    return Buffer.from(content).toString('base64')
}

export function decodeBase64(content: string): string {
    return Buffer.from(content, 'base64').toString('utf8')
}
