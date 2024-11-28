import { Client, ClientOptions } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

const name = 'aidev-vscode-client'
const version = '0.0.1'
const options: ClientOptions = { capabilities: {} }

export async function createClient(port?: number): Promise<Client | undefined> {
    if (!port) {
        return undefined
    }

    const client = new Client({ name, version }, options)
    const transport = new SSEClientTransport(new URL(`http://localhost:${port}/mcp`))
    await client.connect(transport)

    return client
}
