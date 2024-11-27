import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { ParametersSchema } from '../../../tools/tool'
import { tools } from '../../../tools/tools'
import { createToolFactory } from './tool'

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
