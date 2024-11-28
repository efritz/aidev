import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol'
import { CallToolRequest, CallToolResult, Tool as McpTool, Progress } from '@modelcontextprotocol/sdk/types'
import chalk from 'chalk'
import { ExecutionContext } from '../../../tools/context'
import { Arguments, ExecutionResult, ParametersSchema, Tool, ToolResult } from '../../../tools/tool'
import { prefixFormatter, withProgress } from '../../../util/progress/progress'

export type Factory = {
    create(mcpTool: McpTool): Tool<Result>
}

type Result = CallToolResult['content']

export function createToolFactory(client: Client): Factory {
    const serializeArgs = (args: Arguments) => {
        console.log(JSON.stringify(args, null, 2)) // TODO
    }

    const replay = (name: string, args: Arguments, { result, error, canceled }: ToolResult<Result>) => {
        console.log(`${chalk.dim('ℹ')} Called remote tool ${name}:`)
        console.log()
        serializeArgs(args)

        if (canceled) {
            console.log()
            console.log(chalk.dim('ℹ') + ' Tool call was canceled.')
        }
        if (result) {
            console.log(`${error ? chalk.red('✖') : chalk.green('✔')} Tool call ${error ? 'failed' : 'succeeded'}.`)
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
        console.log(`${chalk.dim('ℹ')} Calling remote tool ${name}:`)
        console.log()
        serializeArgs(args)

        const response = await context.interruptHandler.withInterruptHandler(signal => {
            return withProgress<CallToolResult>(
                async updater => {
                    const request: CallToolRequest['params'] = { name, arguments: args }
                    const options: RequestOptions = {
                        onprogress: (progress: Progress) => {
                            updater({ content: [{ type: 'text', text: `${progress.progress} of ${progress.total}` }] }) // TODO
                        },
                        signal,
                    }

                    return (await client.callTool(request, undefined, options)) as CallToolResult
                },
                {
                    progress: prefixFormatter('Executing MCP tool...', snapshot => 'xxxx' + JSON.stringify(snapshot)), // TODO
                    success: prefixFormatter('Executed MCP tool...', snapshot => 'yyyy' + JSON.stringify(snapshot)), // TODO
                    failure: prefixFormatter(
                        'Failed to execute MCP tool...',
                        snapshot => 'zzzz' + JSON.stringify(snapshot), // TODO
                    ),
                },
            )
        })

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
        create: ({ name, description, inputSchema }) => ({
            name,
            description: description || '',
            parameters: inputSchema as ParametersSchema,
            replay: (args, result) => replay(name, args, result),
            execute: (context, _, args) => execute(context, name, args),
            serialize,
        }),
    }
}
