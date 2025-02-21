import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { enabledTools } from '../../../tools/tools'
import { createToolFactory } from './tool'

export async function registerTools(client?: Client) {
    if (!client) {
        return
    }

    const factory = createToolFactory(client)
    const { tools: mcpTools } = await client.listTools()
    enabledTools.push(...mcpTools.map(mcpTool => factory.create(mcpTool)))
}
