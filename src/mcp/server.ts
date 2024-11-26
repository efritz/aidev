import { Server as ModelContextProtocolServer } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'

export function createModelContextProtocolServer(): ModelContextProtocolServer {
    const serverInfo = { name: 'example-server', version: '1.0.0' }
    const options = { capabilities: { resources: {}, tools: {} } }
    const server = new ModelContextProtocolServer(serverInfo, options)

    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: [
            {
                uri: 'file:///example.txt',
                name: 'Example Resource',
            },
        ],
    }))

    server.setRequestHandler(ReadResourceRequestSchema, async request => {
        if (request.params.uri !== 'file:///example.txt') {
            throw new Error('Resource not found')
        }

        return {
            contents: [
                {
                    uri: 'file:///example.txt',
                    mimeType: 'text/plain',
                    text: 'This is the content of the example resource.',
                },
            ],
        }
    })

    return server
}
