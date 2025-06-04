import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js'
import { CallToolRequest, CallToolResult, Tool as McpTool, Progress } from '@modelcontextprotocol/sdk/types.js'
import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../../chat/context'
import { ExecutionResult, Tool, ToolResult } from '../../../tools/tool'
import { CancelError } from '../../../util/interrupts/interrupts'
import { prefixFormatter, withProgress } from '../../../util/progress/progress'
import { parseError } from '../../tools/error'
import { progressToResult } from '../../tools/progress'
import { serializeResult } from '../../tools/serialize'

export type Factory = {
    create(mcpTool: McpTool): Tool<z.ZodObject<any>, Result>
}

type Arguments = { [x: string]: unknown } | undefined
type Result = CallToolResult['content']

export function createToolFactory(client: Client): Factory {
    const serializeArgs = (args: Arguments): string => {
        return JSON.stringify(args, null, 2)
    }

    const formatOutput = (result?: CallToolResult): string => {
        return result ? serializeResult(result.content) : ''
    }

    const replay = (name: string, args: Arguments, { result, error, canceled }: ToolResult<Result>) => {
        const nameAndArgs = `${name}: ${serializeArgs(args)}`
        console.log(`${chalk.dim('ℹ')} Executed remote tool ${nameAndArgs}`)

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

    const execute = async (context: ChatContext, name: string, args: Arguments): Promise<ExecutionResult<Result>> => {
        const nameAndArgs = `${name}: ${serializeArgs(args)}`
        const progressFormatter = prefixFormatter(`Executing remote tool ${nameAndArgs}`, formatOutput)
        const successFormatter = prefixFormatter(`Executed remote tool ${nameAndArgs}`, formatOutput)
        const failureFormatter = prefixFormatter(`Failed to execute remote tool ${nameAndArgs}`, formatOutput)
        const chooseFormatter = (snapshot?: CallToolResult) => (snapshot?.isError ? failureFormatter : successFormatter)

        try {
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
                        progress: progressFormatter,
                        success: (snapshot, error) => chooseFormatter(snapshot)(snapshot, error),
                        failure: failureFormatter,
                    },
                )
            })

            if (!response.ok || response.response.isError) {
                const error = !response.ok ? response.error : parseError(response.response.content)
                console.log(chalk.bold.red(error))
                console.log()

                return { error }
            } else {
                return { result: response.response.content }
            }
        } catch (error: any) {
            if (error instanceof CancelError) {
                return { canceled: true }
            }

            throw error
        }
    }

    return {
        create: ({ name, description, inputSchema }) => ({
            name,
            description: description || '',
            schema: jsonSchemaToZodSchema(inputSchema),
            enabled: true,
            replay: (args, result) => replay(name, args, result),
            execute: (context, _, args) => execute(context, name, args),
            serialize: result => ({ result }),
        }),
    }
}

//
//
//

// Convert JSON Schema to Zod schema
function jsonSchemaToZodSchema(jsonSchema: any): z.ZodObject<any> {
    if (!jsonSchema || jsonSchema.type !== 'object') {
        // Fallback for non-object schemas or missing schemas
        return z.object({})
    }

    const properties = jsonSchema.properties || {}
    const required = jsonSchema.required || []
    const zodProperties: Record<string, z.ZodTypeAny> = {}

    for (const [key, prop] of Object.entries(properties)) {
        const propSchema = prop as any
        let zodType: z.ZodTypeAny

        switch (propSchema.type) {
            case 'string':
                zodType = z.string()
                break
            case 'number':
                zodType = z.number()
                break
            case 'integer':
                zodType = z.number().int()
                break
            case 'boolean':
                zodType = z.boolean()
                break
            case 'array':
                if (propSchema.items) {
                    const itemSchema = jsonSchemaToZodSchema(propSchema.items)
                    zodType = z.array(itemSchema)
                } else {
                    zodType = z.array(z.unknown())
                }
                break
            case 'object':
                zodType = jsonSchemaToZodSchema(propSchema)
                break
            default:
                zodType = z.unknown()
        }

        // Add description if available
        if (propSchema.description) {
            zodType = zodType.describe(propSchema.description)
        }

        // Make optional if not required
        if (!required.includes(key)) {
            zodType = zodType.optional()
        }

        zodProperties[key] = zodType
    }

    return z.object(zodProperties)
}
