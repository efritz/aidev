import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { expandDirectoryPatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const readDirectories: Tool<string[]> = {
    name: 'read_directories',
    description: [
        'Add specific directory listings to the conversation context.',
        'The conversation context is always up-to date. Specifying a directory already in the context will not update the context.',
        'The tool result will contain a list of concrete paths loaded into the context.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            paths: {
                type: JSONSchemaDataType.Array,
                description: 'A list of target directory paths to read.',
                items: {
                    type: JSONSchemaDataType.String,
                    description: [
                        'A target directory path or glob pattern.',
                        'Glob patterns are expanded into a set of matching paths.',
                        'Paths that do not exist or refer to a non-directory are ignored.',
                    ].join(' '),
                },
            },
        },
        required: ['paths'],
    },
    enabled: true,
    replay: (_args: Arguments, { result }: ToolResult<string[]>) => {
        console.log(
            (result ?? [])
                .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
                .join('\n'),
        )
    },
    execute: async (context: ChatContext, toolUseId: string, args: Arguments): Promise<ExecutionResult<string[]>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { paths: patterns } = args as { paths: string[] }
        const directoryPaths = (await filterIgnoredPaths(await expandDirectoryPatterns(patterns))).sort()

        context.contextStateManager.addDirectories(directoryPaths, {
            type: 'tool_use',
            toolUseClass: 'read',
            toolUseId,
        })

        console.log(
            directoryPaths
                .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
                .join('\n'),
        )
        console.log('')

        return { result: directoryPaths, reprompt: true }
    },
    serialize: ({ result }: ToolResult<string[]>) => ({
        result: { paths: result ?? [] },
    }),
}
