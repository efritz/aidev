import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol'
import { CallToolRequest, CallToolResult, Tool as McpTool, Progress } from '@modelcontextprotocol/sdk/types'
import chalk from 'chalk'
import { ExecutionContext } from '../../../tools/context'
import { Arguments, ExecutionResult, ParametersSchema, Tool, ToolResult } from '../../../tools/tool'
import { dynamicPrefixFormatter, prefixFormatter, withProgress } from '../../../util/progress/progress'
import { parseError } from '../../tools/error'
import { progressToResult } from '../../tools/progress'
import { serializeResult } from '../../tools/serialize'

export type Factory = {
    create(mcpTool: McpTool): Tool<Result>
}

type Result = CallToolResult['content']

export function createToolFactory(client: Client): Factory {
    const serializeArgs = (args: Arguments): string => {
        return JSON.stringify(args, null, 2)
    }

    const formatOutput = (result?: CallToolResult): string => {
        return result ? serializeResult(result.content) : ''
    }

    const replay = (name: string, args: Arguments, { result, error, canceled }: ToolResult<Result>) => {
        console.log(`${chalk.dim('ℹ')} Executed remote tool ${name}: ${serializeArgs(args)}`)

        if (canceled) {
            console.log()
            console.log(chalk.dim('ℹ') + ' Tool execution was canceled.')
        }
        if (result) {
            console.log(
                `${error ? chalk.red('✖') : chalk.green('✔')} Tool execution ${error ? 'failed' : 'succeeded'}.`,
            )
            console.log()
            console.log(serializeResult(result))
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
        console.log(`${chalk.dim('ℹ')} Executing remote tool ${name}:`)
        console.log()
        console.log(serializeArgs(args))

        const response = await context.interruptHandler.withInterruptHandler(signal => {
            return withProgress<CallToolResult>(
                async updater => {
                    const request: CallToolRequest['params'] = {
                        name,
                        arguments: args,
                    }

                    const options: RequestOptions = {
                        onprogress: (progress: Progress) => updater(progressToResult(progress)),
                        signal,
                    }

                    const result = (await client.callTool(request, undefined, options)) as CallToolResult
                    updater(result)
                    return result
                },
                {
                    // TODO - cleanup
                    progress: prefixFormatter(`Executing remote tool ${name}...`, formatOutput),
                    success: dynamicPrefixFormatter((snapshot?: CallToolResult) => ({
                        prefix: snapshot?.isError
                            ? `Failed to execute remote tool ${name}...`
                            : `Executed remote tool ${name}...`,
                        output: formatOutput(snapshot),
                    })),
                    failure: prefixFormatter(`Failed to execute remote tool ${name}...`, formatOutput),
                },
            )
        })

        if (!response.ok || response.response.isError) {
            const error = !response.ok ? response.error : parseError(response.response)
            console.log(chalk.bold.red(error))
            console.log()

            return { error }
        } else {
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
