import chalk from 'chalk'
import { expandDirectoryPatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const readDirectories: Tool<string[]> = {
    name: 'read_directories',
    description: [
        'Add directory paths to be included in the conversation context.',
        'The conversation context is always up-to date. Specifying a directory already in the context will not update the context.',
        'The tool result will contain a list of available concrete paths.',
        'The tool result will not contain any directory entries, but the directory entries will be included in the conversation context.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
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
    replay: (args: Arguments, { result }: ToolResult<string[]>) => {
        console.log(
            (result ?? [])
                .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
                .join('\n'),
        )
    },
    execute: async (
        context: ExecutionContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<string[]>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { paths: patterns } = args as { paths: string[] }
        const directoryPaths = (await filterIgnoredPaths(await expandDirectoryPatterns(patterns))).sort()

        for (const path of directoryPaths) {
            context.contextStateManager.addDirectory(path, { type: 'tool_use', toolUseId })
        }

        console.log(
            directoryPaths
                .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
                .join('\n'),
        )
        console.log('')

        return { result: directoryPaths, reprompt: true }
    },
    serialize: ({ result }: ToolResult<string[]>) => JSON.stringify({ paths: result ?? [] }),
}
