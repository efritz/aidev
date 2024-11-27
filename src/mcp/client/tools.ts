import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import chalk from 'chalk'
import { ExecutionContext } from '../../tools/context'
import { Arguments, ExecutionResult, ParametersSchema, Tool, ToolResult } from '../../tools/tool'
import { prefixFormatter, withProgress } from '../../util/progress/progress'

export type Factory = {
    create(mcpTool: { name: string; description: string; parameters: ParametersSchema }): Tool<Result>
}

type ModelContextProtocolToolResult = {
    content: Result
    isError?: boolean
}

type Result = Content[]
type Content = TextContent | EmbeddedResourceContent
type TextContent = { type: 'text'; text: string }
type EmbeddedResourceContent = { type: 'resource'; resource: TextResource | BlobResource }
type Resource = { uri: string; mimeType?: string }
type TextResource = Resource & { text: string }
type BlobResource = Resource & { blob: string } // base64 encoded

export function createToolFactory(client: Client): Factory {
    const replay = (name: string, args: Arguments, { result, error, canceled }: ToolResult<Result>) => {
        console.log(`${chalk.dim('ℹ')} MCP Tool ${name}:`) // TODO
        console.log()
        console.log({ args }) // TODO

        if (canceled) {
            console.log()
            console.log(chalk.dim('ℹ') + ' Tool was canceled.')
        }
        if (result) {
            console.log(`${error ? chalk.red('✖') : chalk.green('✔')} Tool ${error ? 'failed' : 'succeeded'}.`)
            console.log()
            console.log({ result }) // TODO
        }
        if (error) {
            console.log()
            console.log(chalk.bold.red(error))
        }
    }

    const execute = async (
        context: ExecutionContext,
        name: string,
        args: Arguments,
    ): Promise<ExecutionResult<Result>> => {
        console.log(`${chalk.dim('ℹ')} MCP Tool ${name}:`) // TODO
        console.log()
        console.log({ args }) // TODO

        const response = await withProgress<ModelContextProtocolToolResult>(
            async () => (await client.callTool({ name, arguments: args }, undefined)) as ModelContextProtocolToolResult,
            {
                progress: prefixFormatter('Executing MCP tool...', () => '<TODO1>'),
                success: prefixFormatter('Executed MCP tool...', () => '<TODO2>'),
                failure: prefixFormatter('Failed to execute MCP tool...', () => '<TODO3>'),
            },
        )

        if (!response.ok) {
            console.log(chalk.bold.red(response.error))
            console.log()

            return { error: response.error }
        } else {
            const _ = response.response.isError // TODO
            return { result: response.response.content }
        }
    }

    const serialize = ({ result, error, canceled }: ToolResult<Result>) => {
        return JSON.stringify({
            error,
            canceled,
            result,
        })
    }

    return {
        create: ({ name, description, parameters }) => ({
            name,
            description,
            parameters,
            replay: (args, result) => replay(name, args, result),
            execute: (context, _, args) => execute(context, name, args),
            serialize,
        }),
    }
}
