import { Server as ModelContextProtocolServer, Server, ServerOptions } from '@modelcontextprotocol/sdk/server/index.js'
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import {
    CallToolRequest,
    CallToolRequestSchema,
    CallToolResult,
    ListResourcesRequestSchema,
    ListResourcesResult,
    ListToolsRequestSchema,
    Tool as McpTool,
    Notification,
} from '@modelcontextprotocol/sdk/types.js'
import { OutputChannel } from 'vscode'
import { executeTool, tools } from './tools/tools'

const name = 'aidev-vscode-server'
const version = '0.0.1'
const options: ServerOptions = { capabilities: { tools: {}, resources: {} } }

export function createModelContextProtocolServer(
    outputChannel: OutputChannel,
    openDocumentURIs: Set<string>,
): ModelContextProtocolServer {
    const server = new ModelContextProtocolServer({ name, version }, options)
    server.setRequestHandler(ListToolsRequestSchema, createListToolsHandler())
    server.setRequestHandler(CallToolRequestSchema, createCallToolHandler(server, outputChannel))
    server.setRequestHandler(ListResourcesRequestSchema, createListResourcesHandler(openDocumentURIs))

    server.fallbackNotificationHandler = async (notification: Notification) => {
        outputChannel.appendLine(`Received notification: ${JSON.stringify(notification)}`)
    }

    return server
}

function createListToolsHandler(): () => Promise<{ tools: McpTool[] }> {
    return async () => ({
        tools: tools.map(({ name, description, parameters: params }) => ({
            name,
            description,
            inputSchema: params,
        })),
    })
}

function createCallToolHandler(
    server: Server,
    outputChannel: OutputChannel,
): (req: CallToolRequest, extra: RequestHandlerExtra) => Promise<CallToolResult> {
    const log = (...args: any): void => {
        outputChannel.appendLine(args.join(' '))
    }

    return async ({ params: { _meta, name, arguments: args } }, { signal }) => {
        const notify = async (args: any): Promise<void> => {
            const progressToken = _meta?.progressToken

            if (progressToken) {
                await server.notification({
                    method: 'notifications/progress',
                    params: { ...args, progressToken },
                })
            }
        }

        return executeTool({ log, notify, signal }, name, args)
    }
}

function createListResourcesHandler(openDocumentURIs: Set<string>): () => Promise<ListResourcesResult> {
    return async () => ({
        resources: [...openDocumentURIs].sort().map(name => ({
            uri: `file://${name}`,
            name,
        })),
    })
}
