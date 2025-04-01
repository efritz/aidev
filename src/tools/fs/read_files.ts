import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { expandFilePatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const readFiles: Tool<string[]> = {
    name: 'read_files',
    description: [
        'Add specific files to the conversation context.',
        'The conversation context is always up-to date. Specifying a file already in the context will not update the context.',
        'The tool result will contain a list of concrete paths loaded into the context.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            paths: {
                type: JSONSchemaDataType.Array,
                description: 'A list of target file paths to read.',
                items: {
                    type: JSONSchemaDataType.String,
                    description: [
                        'A target file path or glob pattern.',
                        'Glob patterns are expanded into a set of matching paths.',
                        'Paths that do not exist or refer to a non-file are ignored.',
                    ].join(' '),
                },
            },
        },
        required: ['paths'],
    },
    enabled: true,
    replay: (_args: Arguments, { result }: ToolResult<string[]>) => {
        console.log(
            (result ?? []).map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`).join('\n'),
        )
    },
    execute: async (context: ChatContext, toolUseId: string, args: Arguments): Promise<ExecutionResult<string[]>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { paths: patterns } = args as { paths: string[] }
        const filePaths = (await filterIgnoredPaths(await expandFilePatterns(patterns))).sort()

        await context.contextStateManager.addFiles(filePaths, { type: 'tool_use', toolUseClass: 'read', toolUseId })

        console.log(
            filePaths.map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`).join('\n'),
        )
        console.log('')

        return { result: filePaths, reprompt: true }
    },
    serialize: ({ result }: ToolResult<string[]>) => JSON.stringify({ paths: result ?? [] }),
}
