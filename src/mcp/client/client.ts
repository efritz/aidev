import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

export async function createClient(port?: number): Promise<Client | undefined> {
    if (!port) {
        return undefined
    }

    const clientInfo = { name: 'aidev-vscode-client', version: '0.0.1' }
    const options = { capabilities: {} }
    const client = new Client(clientInfo, options)

    const url = new URL(`http://localhost:${port}/mcp`)
    await client.connect(new SSEClientTransport(url))

    return client
}
