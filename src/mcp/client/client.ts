import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { ParametersSchema } from '../../tools/tool'
import { tools } from '../../tools/tools'
import { createToolFactory } from './tools'

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

export async function registerTools(client?: Client) {
    if (!client) {
        return
    }

    const factory = createToolFactory(client)
    const { tools: mcpTools } = await client.listTools()

    for (const mcpTool of mcpTools) {
        tools.push(
            factory.create({
                name: mcpTool.name,
                description: mcpTool.description || '',
                parameters: mcpTool.inputSchema as ParametersSchema,
            }),
        )
    }
}
