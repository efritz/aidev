import chalk from 'chalk'
import { indexWorkspace, isIndexUpToDate } from '../../embeddings/workspace'
import { queryWorkspace } from '../../embeddings/workspace/query'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const searchWorkspace: Tool<string[]> = {
    name: 'search_workspace',
    description: [
        'Match files in the embeddings index of the current workspace against an input query.',
        'Add matching files to the conversation context.',
        'The conversation context is always up-to date. A matching file already in the context will not update the context.',
        'The tool result will contain a list of concrete paths loaded into the context.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            query: {
                type: JSONSchemaDataType.String,
                description: 'The input embeddings search query.',
            },
        },
        required: ['query'],
    },
    replay: (args: Arguments, { result }: ToolResult<string[]>) => {
        const { query } = args as { query: string }
        console.log(`${chalk.dim('ℹ')} Queried workspace index for "${query}".`)

        const filePaths = result ?? []
        if (filePaths.length === 0) {
            console.log(`${chalk.dim('ℹ')} No files found in the workspace embeddings index matching the query.`)
        } else {
            console.log(
                filePaths.map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`).join('\n'),
            )
        }
    },
    execute: async (
        context: ExecutionContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<string[]>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { query } = args as { query: string }
        console.log(`${chalk.dim('ℹ')} Querying workspace index for "${query}"...`)

        if (!(await isIndexUpToDate(context))) {
            console.log(chalk.red.bold('Workspace index is stale.'))

            const choice = await context.prompter.choice(`Update workspace index?`, [
                { name: 'y', description: 'yes' },
                { name: 'n', description: 'no', isDefault: true },
            ])

            if (choice === 'y') {
                await indexWorkspace(context)
            }
        }

        const chunks = await queryWorkspace(context, query)
        const filePaths = [...new Set(chunks.map(chunk => chunk.filename))].sort()

        for (const path of filePaths) {
            await context.contextStateManager.addFile(path, { type: 'tool_use', toolUseClass: 'read', toolUseId })
        }

        if (filePaths.length === 0) {
            console.log(`${chalk.dim('ℹ')} No files found in the workspace embeddings index matching the query.`)
        } else {
            console.log(
                filePaths.map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`).join('\n'),
            )
        }
        console.log('')

        return { result: filePaths, reprompt: true }
    },
    serialize: ({ result }: ToolResult<string[]>) => JSON.stringify({ paths: result ?? [] }),
}
