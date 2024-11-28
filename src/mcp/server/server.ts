import { Server as ModelContextProtocolServer, Server, ServerOptions } from '@modelcontextprotocol/sdk/server/index.js'
import {
    CallToolRequest,
    CallToolRequestSchema,
    CallToolResult,
    ListToolsRequestSchema,
    Tool as McpTool,
} from '@modelcontextprotocol/sdk/types.js'
import { OutputChannel } from 'vscode'
import { ExecutionContext } from './tools/context'
import { executeTool, tools } from './tools/tools'

const name = 'aidev-vscode-server'
const version = '0.0.1'
const options: ServerOptions = { capabilities: { tools: {} } }

export function createModelContextProtocolServer(outputChannel: OutputChannel): ModelContextProtocolServer {
    const server = new ModelContextProtocolServer({ name, version }, options)
    server.setRequestHandler(ListToolsRequestSchema, listTools)
    server.setRequestHandler(CallToolRequestSchema, createCallTool(server, outputChannel))

    return server
}

async function listTools(): Promise<{ tools: McpTool[] }> {
    return {
        tools: tools.map(({ name, description, parameters: params }) => ({
            name,
            description,
            inputSchema: params,
        })),
    }
}

function createCallTool(
    server: Server,
    outputChannel: OutputChannel,
): (req: CallToolRequest) => Promise<CallToolResult> {
    return async ({ params: { _meta, name, arguments: args } }) => {
        const context: ExecutionContext = {
            log: (...args: any) => {
                outputChannel.appendLine(args.join(' '))
            },

            notify: async (args: any) => {
                const progressToken = _meta?.progressToken

                if (progressToken) {
                    await server.notification({
                        method: 'notifications/progress',
                        params: { ...args, progressToken },
                    })
                }
            },
        }

        return executeTool(context, name, args)
    }
}
