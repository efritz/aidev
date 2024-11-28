import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { tools } from '../../../tools/tools'
import { createToolFactory } from './tool'

export async function registerTools(client?: Client) {
    if (!client) {
        return
    }

    const factory = createToolFactory(client)
    const { tools: mcpTools } = await client.listTools()
    tools.push(...mcpTools.map(mcpTool => factory.create(mcpTool)))
}
