import { Server as ModelContextProtocolServer } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { findTool, tools } from './tools/tools'

export function createModelContextProtocolServer(): ModelContextProtocolServer {
    const serverInfo = { name: 'aidev-vscode-server', version: '0.0.1' }
    const options = { capabilities: { tools: {} } }
    const server = new ModelContextProtocolServer(serverInfo, options)
    const context = {}

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.parameters,
        })),
    }))

    server.setRequestHandler(CallToolRequestSchema, async req => {
        try {
            const { name, arguments: args } = req.params
            return findTool(name).execute(context, args)
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
                    },
                ],
            }
        }
    })

    return server
}
