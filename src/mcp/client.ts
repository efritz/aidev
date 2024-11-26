import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { ListResourcesResultSchema, ReadResourceResultSchema } from '@modelcontextprotocol/sdk/types.js'

export async function createClient(port?: number): Promise<Client | undefined> {
    if (!port) {
        return undefined
    }

    const clientInfo = { name: 'example-client', version: '1.0.0' }
    const options = { capabilities: {} }
    const client = new Client(clientInfo, options)

    const url = new URL(`http://localhost:${port}/mcp`)
    await client.connect(new SSEClientTransport(url))

    return client
}

export async function testClient(client?: Client) {
    if (!client) {
        return
    }

    {
        //
        // List available resources

        const req = { method: 'resources/list' }
        const resultSchema = ListResourcesResultSchema
        const resources = await client.request(req, resultSchema)
        console.log({ resources })
    }

    {
        //
        //
        // Read a specific resource

        const params = { uri: 'file:///example.txt' }
        const req = { method: 'resources/read', params }
        const resultSchema = ReadResourceResultSchema
        const resourceContent = await client.request(req, resultSchema)
        console.log({ resourceContent })
    }
}
