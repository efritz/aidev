import { Server as ModelContextProtocolServer } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { tools } from './tools'

export function createModelContextProtocolServer(): ModelContextProtocolServer {
    const serverInfo = { name: 'aidev-vscode-server', version: '0.0.1' }
    const options = { capabilities: { tools: {} } }
    const server = new ModelContextProtocolServer(serverInfo, options)

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

    server.setRequestHandler(CallToolRequestSchema, async req => {
        try {
            const { name, arguments: args } = req.params

            for (const tool of tools) {
                if (tool.name === name) {
                    return tool.execute(args)
                }
            }

            throw new Error('Tool not found')
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
