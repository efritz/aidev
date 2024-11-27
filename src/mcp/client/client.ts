import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import chalk from 'chalk'
import { ExecutionContext } from '../../tools/context'
import { Arguments, ExecutionResult, JSONSchemaDataType, ParametersSchema, Tool, ToolResult } from '../../tools/tool'
import { tools } from '../../tools/tools'

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

    const { tools: mcpTools } = await client.listTools()

    for (const mcpTool of mcpTools) {
        tools.push(mcpToolToTool(client, mcpTool))
    }
}

//
//

function mcpToolToTool(client: Client, mcpTool: { name: string; description?: string; inputSchema: any }): Tool<any> {
    return {
        name: mcpTool.name,
        description: mcpTool.description ?? '',
        parameters: inputSchemaToParameters(mcpTool.inputSchema),
        replay: (args: Arguments, { result, error, canceled }: ToolResult<any>) => {
            if (!result) {
                console.log()
                console.log(chalk.bold.red(error))
                console.log()
            } else {
                // TODO
                console.log('Replaying MCP tool...')
            }
        },
        execute: async (
            context: ExecutionContext,
            toolUseId: string,
            args: Arguments,
        ): Promise<ExecutionResult<any>> => {
            console.log('Executing MCP tool...')
            const result = await client.callTool({ name: mcpTool.name, arguments: args }, undefined)
            console.log('Executed MCP tool...', { result })
            return { result }
        },
        serialize: (result: ToolResult<any>) => {
            return JSON.stringify(result)
        },
    }
}

function inputSchemaToParameters(inputSchema: any): ParametersSchema {
    return {
        type: JSONSchemaDataType.Object,
        properties: (inputSchema.properties as any) ?? {},
        required: (inputSchema.required as any) ?? [],
    }
}
